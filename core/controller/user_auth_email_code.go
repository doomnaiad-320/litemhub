package controller

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/common/mailer"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"gorm.io/gorm"
)

var (
	errUserPortalRegisterCodeNotFound        = errors.New("verification code not found or expired")
	errUserPortalRegisterCodeExpired         = errors.New("verification code expired")
	errUserPortalRegisterCodeInvalid         = errors.New("verification code is invalid")
	errUserPortalRegisterCodeTooManyAttempts = errors.New("verification code attempts exceeded")
	errUserPortalRegisterCodeCooldown        = errors.New("please wait before requesting another verification code")
)

func SendUserRegisterEmailCode(c *gin.Context) {
	req := UserAuthEmailCodeRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Email = normalizeUserPortalEmail(req.Email)
	if message := validateUserPortalEmail(req.Email); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	if _, err := model.GetAppUserByEmail(req.Email); err == nil {
		middleware.ErrorResponse(c, http.StatusConflict, "email already exists")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	now := time.Now()
	cooldown := time.Duration(config.RegisterEmailCodeCooldownSeconds) * time.Second
	record, err := model.GetAppUserRegisterCodeByEmail(req.Email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	if record != nil && !record.LastSentAt.IsZero() && now.Sub(record.LastSentAt) < cooldown {
		waitSeconds := int64((cooldown - now.Sub(record.LastSentAt)).Seconds())
		if waitSeconds < 1 {
			waitSeconds = 1
		}
		middleware.ErrorResponse(c, http.StatusTooManyRequests, fmt.Sprintf("please wait %d seconds before requesting another code", waitSeconds))
		return
	}

	code, err := generateUserPortalRegisterCode()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	expiresAt := now.Add(time.Duration(config.RegisterEmailCodeTTLMinutes) * time.Minute)
	codeHash := hashUserPortalRegisterCode(code)
	if _, err := model.UpsertAppUserRegisterCode(req.Email, codeHash, 0, expiresAt, now); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	if err := mailer.SendVerificationCodeEmail(req.Email, code, config.RegisterEmailCodeTTLMinutes); err != nil {
		_ = model.DeleteAppUserRegisterCodeByEmail(req.Email)
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"expires_at":       expiresAt.UnixMilli(),
		"cooldown_seconds": config.RegisterEmailCodeCooldownSeconds,
	})
}

func verifyUserPortalRegisterEmailCode(email, code string) error {
	record, err := model.GetAppUserRegisterCodeByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errUserPortalRegisterCodeNotFound
		}

		return err
	}

	now := time.Now()
	if now.After(record.ExpiresAt) {
		_ = model.DeleteAppUserRegisterCodeByEmail(email)
		return errUserPortalRegisterCodeExpired
	}

	maxAttempts := int(config.RegisterEmailCodeMaxAttempts)
	if record.Attempts >= maxAttempts {
		_ = model.DeleteAppUserRegisterCodeByEmail(email)
		return errUserPortalRegisterCodeTooManyAttempts
	}

	if hashUserPortalRegisterCode(code) != record.CodeHash {
		record.Attempts++
		if record.Attempts >= maxAttempts {
			_ = model.DeleteAppUserRegisterCodeByEmail(email)
			return errUserPortalRegisterCodeTooManyAttempts
		}

		if err := model.UpdateAppUserRegisterCodeAttempts(email, record.Attempts); err != nil {
			return err
		}

		return errUserPortalRegisterCodeInvalid
	}

	if err := model.DeleteAppUserRegisterCodeByEmail(email); err != nil {
		return err
	}

	return nil
}

func generateUserPortalRegisterCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("failed to generate verification code: %w", err)
	}

	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashUserPortalRegisterCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}
