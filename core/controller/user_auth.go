package controller

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserAuthRegisterRequest struct {
	Username      string `json:"username"`
	Email         string `json:"email"`
	Code          string `json:"code"`
	Password      string `json:"password"`
	AcceptedTerms bool   `json:"accepted_terms"`
}

type UserAuthLoginRequest struct {
	Account       string `json:"account"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	AcceptedTerms bool   `json:"accepted_terms"`
}

type UserAuthEmailCodeRequest struct {
	Email string `json:"email"`
}

type UserAuthEmailCodeResponse struct {
	ExpiresAt       int64 `json:"expires_at"`
	CooldownSeconds int64 `json:"cooldown_seconds"`
}

type UserAuthUpdatePasswordRequest struct {
	CurrentPassword    string `json:"current_password"`
	NewPassword        string `json:"new_password"`
	ConfirmNewPassword string `json:"confirm_new_password"`
}

type AppUserResponse struct {
	ID        int    `json:"id"`
	Username  string `json:"username,omitempty"`
	Email     string `json:"email,omitempty"`
	Status    int    `json:"status"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

func buildAppUserResponse(user *model.AppUser) *AppUserResponse {
	return &AppUserResponse{
		ID:        user.ID,
		Username:  string(user.Username),
		Email:     string(user.Email),
		Status:    user.Status,
		CreatedAt: user.CreatedAt.UnixMilli(),
		UpdatedAt: user.UpdatedAt.UnixMilli(),
	}
}

func normalizeUserPortalEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeUserPortalUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func validateUserPortalUsername(username string) string {
	username = normalizeUserPortalUsername(username)
	if username == "" {
		return "username is required"
	}

	if len(username) < 3 || len(username) > 32 {
		return "username must be 3 to 32 characters"
	}

	for _, r := range username {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '_' || r == '-':
		default:
			return "username can only contain lowercase letters, numbers, underscores and hyphens"
		}
	}

	return ""
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

func validateUserPortalLoginRequest(account, password string) string {
	if strings.TrimSpace(account) == "" {
		return "email or username is required"
	}

	if strings.TrimSpace(password) == "" {
		return "password is required"
	}

	return ""
}

func validateUserPortalUpdatePasswordRequest(currentPassword, newPassword, confirmNewPassword string) string {
	if strings.TrimSpace(currentPassword) == "" {
		return "current password is required"
	}

	if message := validateUserPassword(newPassword); message != "" {
		return message
	}

	if newPassword != confirmNewPassword {
		return "new passwords do not match"
	}

	if currentPassword == newPassword {
		return "new password must be different from current password"
	}

	return ""
}

func validateUserPortalAcceptedTerms(accepted bool) string {
	if !accepted {
		return "terms must be accepted"
	}

	return ""
}

func validateUserPortalRegisterRequest(username, email, code, password string) string {
	if message := validateUserPortalUsername(username); message != "" {
		return message
	}

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

func validateUserRegisterRequest(username, email, phone, password string) string {
	if username == "" && email == "" && phone == "" {
		return "username, email or phone is required"
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
	req.Username = normalizeUserPortalUsername(req.Username)

	if message := validateUserPortalAcceptedTerms(req.AcceptedTerms); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	if message := validateUserPortalRegisterRequest(req.Username, req.Email, req.Code, req.Password); message != "" {
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
		Username:     model.EmptyNullString(req.Username),
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

	req.Account = strings.TrimSpace(req.Account)
	if req.Account == "" {
		req.Account = strings.TrimSpace(req.Email)
	}

	if message := validateUserPortalAcceptedTerms(req.AcceptedTerms); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	if message := validateUserPortalLoginRequest(req.Account, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	user, err := model.GetAppUserByEmailOrUsername(req.Account)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusUnauthorized, "invalid account or password")
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
		middleware.ErrorResponse(c, http.StatusUnauthorized, "invalid account or password")
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

func UpdateCurrentAppUserPassword(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	req := UserAuthUpdatePasswordRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	if message := validateUserPortalUpdatePasswordRequest(
		req.CurrentPassword,
		req.NewPassword,
		req.ConfirmNewPassword,
	); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		middleware.ErrorResponse(c, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	updatedUser, err := model.UpdateAppUserPasswordHash(user.ID, string(passwordHash))
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
		case errors.Is(err, model.ErrAppUserPasswordHashEmpty):
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	middleware.SuccessResponse(c, gin.H{
		"user": buildAppUserResponse(updatedUser),
	})
}
