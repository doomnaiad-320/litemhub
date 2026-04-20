package controller

import (
	"errors"
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
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type UserAuthLoginRequest struct {
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type AppUserResponse struct {
	ID        int    `json:"id"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
	Status    int    `json:"status"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

func buildAppUserResponse(user *model.AppUser) *AppUserResponse {
	return &AppUserResponse{
		ID:        user.ID,
		Email:     string(user.Email),
		Phone:     string(user.Phone),
		Status:    user.Status,
		CreatedAt: user.CreatedAt.UnixMilli(),
		UpdatedAt: user.UpdatedAt.UnixMilli(),
	}
}

func normalizeUserAuthAccount(email, phone string) (string, string) {
	return strings.ToLower(strings.TrimSpace(email)), strings.TrimSpace(phone)
}

func validateUserAuthRequest(email, phone, password string) string {
	if email == "" && phone == "" {
		return "email or phone is required"
	}

	if strings.TrimSpace(password) == "" {
		return "password is required"
	}

	return ""
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

func validateUserRegisterRequest(email, phone, password string) string {
	if email == "" && phone == "" {
		return "email or phone is required"
	}

	return validateUserPassword(password)
}

func findAppUserForLogin(email, phone string) (*model.AppUser, error) {
	if email != "" {
		return model.GetAppUserByEmail(email)
	}

	return model.GetAppUserByPhone(phone)
}

func RegisterAppUser(c *gin.Context) {
	req := UserAuthRegisterRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Email, req.Phone = normalizeUserAuthAccount(req.Email, req.Phone)

	if message := validateUserRegisterRequest(req.Email, req.Phone, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := &model.AppUser{
		Email:        model.EmptyNullString(req.Email),
		Phone:        model.EmptyNullString(req.Phone),
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

	req.Email, req.Phone = normalizeUserAuthAccount(req.Email, req.Phone)

	if message := validateUserAuthRequest(req.Email, req.Phone, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	user, err := findAppUserForLogin(req.Email, req.Phone)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusUnauthorized, "invalid email/phone or password")
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
		middleware.ErrorResponse(c, http.StatusUnauthorized, "invalid email/phone or password")
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
