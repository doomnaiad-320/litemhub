package controller

import (
	"errors"
	"net/mail"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserAuthRegisterRequest struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Password string `json:"password"`
}

type UserAuthLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserAuthEmailCodeRequest struct {
	Email string `json:"email"`
}

type UserAuthEmailCodeResponse struct {
	ExpiresAt       int64 `json:"expires_at"`
	CooldownSeconds int64 `json:"cooldown_seconds"`
}

type AppUserResponse struct {
	ID        int    `json:"id"`
	Email     string `json:"email,omitempty"`
	Status    int    `json:"status"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

func buildAppUserResponse(user *model.AppUser) *AppUserResponse {
	return &AppUserResponse{
		ID:        user.ID,
		Email:     string(user.Email),
		Status:    user.Status,
		CreatedAt: user.CreatedAt.UnixMilli(),
		UpdatedAt: user.UpdatedAt.UnixMilli(),
	}
}

func normalizeUserPortalEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validateUserPortalEmail(email string) string {
	email = normalizeUserPortalEmail(email)
	if email == "" {
		return "email is required"
	}

	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return "invalid email format"
	}

	return ""
}

func validateUserPortalVerificationCode(code string) string {
	code = strings.TrimSpace(code)
	if code == "" {
		return "verification code is required"
	}

	if len(code) != 6 {
		return "verification code must be 6 digits"
	}

	for _, r := range code {
		if r < '0' || r > '9' {
			return "verification code must be 6 digits"
		}
	}

	return ""
}

func validateUserPortalLoginRequest(email, password string) string {
	if message := validateUserPortalEmail(email); message != "" {
		return message
	}

	if strings.TrimSpace(password) == "" {
		return "password is required"
	}

	return ""
}

func validateUserPortalRegisterRequest(email, code, password string) string {
	if message := validateUserPortalEmail(email); message != "" {
		return message
	}

	if message := validateUserPortalVerificationCode(code); message != "" {
		return message
	}

	return validateUserPassword(password)
}

func normalizeUserAuthAccount(email, phone string) (string, string) {
	return strings.ToLower(strings.TrimSpace(email)), strings.TrimSpace(phone)
}

func validateUserRegisterRequest(email, phone, password string) string {
	if email == "" && phone == "" {
		return "email or phone is required"
	}

	return validateUserPassword(password)
}

func validateUserPassword(password string) string {
	if strings.TrimSpace(password) == "" {
		return "password is required"
	}

	if len(password) < 6 {
		return "password must be at least 6 characters"
	}

	return ""
}

func RegisterAppUser(c *gin.Context) {
	req := UserAuthRegisterRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Email = normalizeUserPortalEmail(req.Email)

	if message := validateUserPortalRegisterRequest(req.Email, req.Code, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	if err := verifyUserPortalRegisterEmailCode(req.Email, req.Code); err != nil {
		switch {
		case errors.Is(err, errUserPortalRegisterCodeNotFound),
			errors.Is(err, errUserPortalRegisterCodeExpired),
			errors.Is(err, errUserPortalRegisterCodeInvalid),
			errors.Is(err, errUserPortalRegisterCodeTooManyAttempts):
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := &model.AppUser{
		Email:        model.EmptyNullString(req.Email),
		PasswordHash: string(passwordHash),
		Status:       model.AppUserStatusEnabled,
	}

	if err := model.CreateAppUserWithWallet(user); err != nil {
		if errors.Is(err, model.ErrAppUserAlreadyExists) {
			middleware.ErrorResponse(c, http.StatusConflict, err.Error())
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"user": buildAppUserResponse(user),
	})
}

func LoginAppUser(c *gin.Context) {
	req := UserAuthLoginRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Email = normalizeUserPortalEmail(req.Email)

	if message := validateUserPortalLoginRequest(req.Email, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	user, err := model.GetAppUserByEmail(req.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusUnauthorized, "invalid email or password")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	if user.Status != model.AppUserStatusEnabled {
		middleware.ErrorResponse(c, http.StatusForbidden, "user is disabled")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		middleware.ErrorResponse(c, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, expiresAt, err := middleware.CreateUserJWT(user)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"token":      token,
		"expires_at": expiresAt.UnixMilli(),
		"user":       buildAppUserResponse(user),
	})
}

func GetCurrentAppUser(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	middleware.SuccessResponse(c, gin.H{
		"user": buildAppUserResponse(user),
	})
}
