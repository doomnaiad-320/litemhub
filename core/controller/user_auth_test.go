package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRegisterAppUserDuplicateUsernameDoesNotConsumeEmailCode(t *testing.T) {
	withTestUserAuthDB(t, func() {
		require.NoError(t, model.DB.Create(&model.AppUser{
			Username:     model.EmptyNullString("taken"),
			Email:        model.EmptyNullString("taken@example.com"),
			PasswordHash: "hashed-password",
			Status:       model.AppUserStatusEnabled,
		}).Error)

		email := "new@example.com"
		createTestRegisterCode(t, email, "123456")

		recorder := performRegisterRequest(t, UserAuthRegisterRequest{
			Username:      "taken",
			Email:         email,
			Code:          "000000",
			Password:      "password123",
			AcceptedTerms: true,
		})

		require.Equal(t, http.StatusConflict, recorder.Code)
		require.Equal(t, "username already exists", decodeAPIMessage(t, recorder))

		record, err := model.GetAppUserRegisterCodeByEmail(email)
		require.NoError(t, err)
		require.Equal(t, 0, record.Attempts)
	})
}

func TestRegisterAppUserDuplicateEmailDoesNotConsumeEmailCode(t *testing.T) {
	withTestUserAuthDB(t, func() {
		email := "taken@example.com"
		require.NoError(t, model.DB.Create(&model.AppUser{
			Username:     model.EmptyNullString("taken"),
			Email:        model.EmptyNullString(email),
			PasswordHash: "hashed-password",
			Status:       model.AppUserStatusEnabled,
		}).Error)

		createTestRegisterCode(t, email, "123456")

		recorder := performRegisterRequest(t, UserAuthRegisterRequest{
			Username:      "newuser",
			Email:         email,
			Code:          "000000",
			Password:      "password123",
			AcceptedTerms: true,
		})

		require.Equal(t, http.StatusConflict, recorder.Code)
		require.Equal(t, "email already exists", decodeAPIMessage(t, recorder))

		record, err := model.GetAppUserRegisterCodeByEmail(email)
		require.NoError(t, err)
		require.Equal(t, 0, record.Attempts)
	})
}

func TestRegisterAppUserDeletesEmailCodeAfterSuccessfulCreate(t *testing.T) {
	withTestUserAuthDB(t, func() {
		email := "new@example.com"
		createTestRegisterCode(t, email, "123456")

		recorder := performRegisterRequest(t, UserAuthRegisterRequest{
			Username:      "newuser",
			Email:         email,
			Code:          "123456",
			Password:      "password123",
			AcceptedTerms: true,
		})

		require.Equal(t, http.StatusOK, recorder.Code)

		_, err := model.GetAppUserRegisterCodeByEmail(email)
		require.ErrorIs(t, err, gorm.ErrRecordNotFound)

		user, err := model.GetAppUserByEmail(email)
		require.NoError(t, err)
		require.Equal(t, "newuser", string(user.Username))
	})
}

func TestRegisterAppUserInvalidInviteCodeDoesNotBlockRegistration(t *testing.T) {
	withTestUserAuthDB(t, func() {
		email := "new@example.com"
		createTestRegisterCode(t, email, "123456")

		recorder := performRegisterRequest(t, UserAuthRegisterRequest{
			Username:      "newuser",
			Email:         email,
			Code:          "123456",
			Password:      "password123",
			InviteCode:    "A123",
			AcceptedTerms: true,
		})

		require.Equal(t, http.StatusOK, recorder.Code)

		_, err := model.GetAppUserRegisterCodeByEmail(email)
		require.ErrorIs(t, err, gorm.ErrRecordNotFound)

		user, err := model.GetAppUserByEmail(email)
		require.NoError(t, err)

		_, err = model.GetAppUserReferralByInvitedUserID(user.ID)
		require.ErrorIs(t, err, model.ErrAppUserReferralNotFound)
	})
}

func TestRegisterAppUserWithInviteCodeCreatesReferralAndDeletesEmailCode(t *testing.T) {
	withTestUserAuthDB(t, func() {
		inviter := createTestRegisterAppUser(t, "inviter", "inviter@example.com")
		discountCode := &model.AppUserDiscountCode{
			UserID: inviter.ID,
			Code:   "A123",
			Status: model.AppUserStatusEnabled,
		}
		require.NoError(t, model.DB.Create(discountCode).Error)

		email := "new@example.com"
		createTestRegisterCode(t, email, "123456")

		recorder := performRegisterRequest(t, UserAuthRegisterRequest{
			Username:      "newuser",
			Email:         email,
			Code:          "123456",
			Password:      "password123",
			InviteCode:    "a-123",
			AcceptedTerms: true,
		})

		require.Equal(t, http.StatusOK, recorder.Code)

		_, err := model.GetAppUserRegisterCodeByEmail(email)
		require.ErrorIs(t, err, gorm.ErrRecordNotFound)

		user, err := model.GetAppUserByEmail(email)
		require.NoError(t, err)

		referral, err := model.GetAppUserReferralByInvitedUserID(user.ID)
		require.NoError(t, err)
		require.Equal(t, inviter.ID, referral.InviterUserID)
		require.Equal(t, "A123", string(referral.DiscountCode))
	})
}

func withTestUserAuthDB(t *testing.T, fn func()) {
	t.Helper()

	oldDB := model.DB
	oldUsingSQLite := common.UsingSQLite
	oldMaxAttempts := config.RegisterEmailCodeMaxAttempts

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "user_auth_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.AppUser{},
		&model.AppUserRegisterCode{},
		&model.AppUserWallet{},
		&model.AppUserReferral{},
		&model.AppUserDiscountCode{},
	))

	model.DB = db
	common.UsingSQLite = true
	config.RegisterEmailCodeMaxAttempts = 5

	t.Cleanup(func() {
		model.DB = oldDB
		common.UsingSQLite = oldUsingSQLite
		config.RegisterEmailCodeMaxAttempts = oldMaxAttempts

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	fn()
}

func createTestRegisterAppUser(t *testing.T, username, email string) *model.AppUser {
	t.Helper()

	user := &model.AppUser{
		Username:     model.EmptyNullString(username),
		Email:        model.EmptyNullString(email),
		PasswordHash: "hashed-password",
		Status:       model.AppUserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)

	return user
}

func createTestRegisterCode(t *testing.T, email, code string) {
	t.Helper()

	_, err := model.UpsertAppUserRegisterCode(
		email,
		hashUserPortalRegisterCode(code),
		0,
		time.Now().Add(10*time.Minute),
		time.Now(),
	)
	require.NoError(t, err)
}

func performRegisterRequest(t *testing.T, req UserAuthRegisterRequest) *httptest.ResponseRecorder {
	t.Helper()

	body, err := json.Marshal(req)
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/register", RegisterAppUser)

	request := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	return recorder
}

func decodeAPIMessage(t *testing.T, recorder *httptest.ResponseRecorder) string {
	t.Helper()

	var response struct {
		Message string `json:"message"`
		Success bool   `json:"success"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)

	return response.Message
}
