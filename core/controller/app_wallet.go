package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller/utils"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AppWalletResponse struct {
	UserID             int     `json:"user_id"`
	AvailableBalance   float64 `json:"available_balance"`
	FrozenBalance      float64 `json:"frozen_balance"`
	HistoricalConsumed float64 `json:"historical_consumed"`
	CreatedAt          int64   `json:"created_at"`
	UpdatedAt          int64   `json:"updated_at"`
}

type AppWalletLogResponse struct {
	ID            int     `json:"id"`
	Type          string  `json:"type"`
	Amount        float64 `json:"amount"`
	BalanceBefore float64 `json:"balance_before"`
	BalanceAfter  float64 `json:"balance_after"`
	RequestID     string  `json:"request_id,omitempty"`
	ReservationID int     `json:"reservation_id,omitempty"`
	Remark        string  `json:"remark,omitempty"`
	CreatedAt     int64   `json:"created_at"`
}

type AppUserAdminResponse struct {
	ID               int     `json:"id"`
	Email            string  `json:"email,omitempty"`
	Phone            string  `json:"phone,omitempty"`
	Status           int     `json:"status"`
	AvailableBalance float64 `json:"available_balance"`
	FrozenBalance    float64 `json:"frozen_balance"`
	CreatedAt        int64   `json:"created_at"`
	UpdatedAt        int64   `json:"updated_at"`
}

type RechargeAppUserBalanceRequest struct {
	Amount     float64 `json:"amount"`
	Channel    string  `json:"channel"`
	TradeNo    string  `json:"trade_no"`
	Remark     string  `json:"remark"`
	RawPayload string  `json:"raw_payload"`
}

type CreateAppUserRequest struct {
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
	Status   int    `json:"status"`
}

type UpdateAppUserRequest struct {
	Email *string `json:"email"`
	Phone *string `json:"phone"`
}

type ResetAppUserPasswordRequest struct {
	Password string `json:"password"`
}

type UpdateAppUserStatusRequest struct {
	Status int `json:"status"`
}

func buildAppWalletResponse(wallet *model.AppUserWallet, historicalConsumed float64) *AppWalletResponse {
	return &AppWalletResponse{
		UserID:             wallet.UserID,
		AvailableBalance:   wallet.AvailableBalance,
		FrozenBalance:      wallet.FrozenBalance,
		HistoricalConsumed: historicalConsumed,
		CreatedAt:          wallet.CreatedAt.UnixMilli(),
		UpdatedAt:          wallet.UpdatedAt.UnixMilli(),
	}
}

func buildAppWalletLogResponse(log *model.AppWalletLog) *AppWalletLogResponse {
	return &AppWalletLogResponse{
		ID:            log.ID,
		Type:          log.Type,
		Amount:        log.Amount,
		BalanceBefore: log.BalanceBefore,
		BalanceAfter:  log.BalanceAfter,
		RequestID:     string(log.RequestID),
		ReservationID: log.ReservationID,
		Remark:        log.Remark,
		CreatedAt:     log.CreatedAt.UnixMilli(),
	}
}

func buildAppWalletLogResponses(logs []*model.AppWalletLog) []*AppWalletLogResponse {
	responses := make([]*AppWalletLogResponse, len(logs))
	for i, log := range logs {
		responses[i] = buildAppWalletLogResponse(log)
	}

	return responses
}

func buildAppUserAdminResponse(user *model.AppUser, wallet *model.AppUserWallet) *AppUserAdminResponse {
	response := &AppUserAdminResponse{
		ID:        user.ID,
		Email:     string(user.Email),
		Phone:     string(user.Phone),
		Status:    user.Status,
		CreatedAt: user.CreatedAt.UnixMilli(),
		UpdatedAt: user.UpdatedAt.UnixMilli(),
	}

	if wallet != nil {
		response.AvailableBalance = wallet.AvailableBalance
		response.FrozenBalance = wallet.FrozenBalance
	}

	return response
}

func buildAppUserAdminResponses(users []*model.AppUser, walletMap map[int]*model.AppUserWallet) []*AppUserAdminResponse {
	responses := make([]*AppUserAdminResponse, len(users))
	for i, user := range users {
		responses[i] = buildAppUserAdminResponse(user, walletMap[user.ID])
	}

	return responses
}

func parseAppUserID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid user id")
		return 0, false
	}

	return id, true
}

func getOptionalAppUserWallet(userID int) (*model.AppUserWallet, error) {
	wallet, err := model.GetAppUserWalletByUserID(userID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}

	return wallet, err
}

func respondAppUserAdmin(c *gin.Context, user *model.AppUser) bool {
	wallet, err := getOptionalAppUserWallet(user.ID)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return false
	}

	middleware.SuccessResponse(c, gin.H{
		"user": buildAppUserAdminResponse(user, wallet),
	})

	return true
}

func GetCurrentUserWallet(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	wallet, err := model.GetAppUserWalletByUserID(user.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "wallet not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	historicalConsumed, err := model.GetAppWalletHistoricalConsumed(user.ID)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"wallet": buildAppWalletResponse(wallet, historicalConsumed),
	})
}

func GetCurrentUserWalletLogs(c *gin.Context) {
	user := middleware.GetWalletUser(c)
	page, perPage := utils.ParsePageParams(c)
	order := c.DefaultQuery("order", "")

	logs, total, err := model.GetAppWalletLogsByTypes(
		user.ID,
		page,
		perPage,
		order,
		[]string{model.AppWalletLogTypeRecharge},
	)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"wallet_logs": buildAppWalletLogResponses(logs),
		"total":       total,
	})
}

func GetAppUsers(c *gin.Context) {
	page, perPage := utils.ParsePageParams(c)
	keyword := c.Query("keyword")
	order := c.DefaultQuery("order", "")
	status, _ := strconv.Atoi(c.Query("status"))

	users, total, err := model.GetAppUsers(keyword, page, perPage, order, status)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	userIDs := make([]int, 0, len(users))
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	walletMap, err := model.GetAppUserWalletsByUserIDs(userIDs)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"app_users": buildAppUserAdminResponses(users, walletMap),
		"total":     total,
	})
}

func SearchAppUsers(c *gin.Context) {
	GetAppUsers(c)
}

func CreateAppUser(c *gin.Context) {
	req := CreateAppUserRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Email, req.Phone = normalizeUserAuthAccount(req.Email, req.Phone)
	if message := validateUserRegisterRequest(req.Email, req.Phone, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	status := req.Status
	if status == 0 {
		status = model.AppUserStatusEnabled
	}
	if !model.IsAppUserStatusValid(status) {
		middleware.ErrorResponse(c, http.StatusBadRequest, model.ErrAppUserStatusInvalid.Error())
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
		Status:       status,
	}
	if err = model.CreateAppUserWithWallet(user); err != nil {
		switch {
		case errors.Is(err, model.ErrAppUserAlreadyExists):
			middleware.ErrorResponse(c, http.StatusConflict, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	respondAppUserAdmin(c, user)
}

func GetAppUser(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	user, err := model.GetAppUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondAppUserAdmin(c, user)
}

func UpdateAppUser(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	req := UpdateAppUserRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	if req.Email == nil && req.Phone == nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "no fields to update")
		return
	}

	user, err := model.GetAppUserByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	email := string(user.Email)
	phone := string(user.Phone)
	if req.Email != nil {
		email = *req.Email
	}
	if req.Phone != nil {
		phone = *req.Phone
	}

	email, phone = normalizeUserAuthAccount(email, phone)
	user, err = model.UpdateAppUserAccount(userID, email, phone)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
		case errors.Is(err, model.ErrAppUserAccountInvalid):
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, model.ErrAppUserAlreadyExists):
			middleware.ErrorResponse(c, http.StatusConflict, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	respondAppUserAdmin(c, user)
}

func ResetAppUserPassword(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	req := ResetAppUserPasswordRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	if message := validateUserPassword(req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := model.UpdateAppUserPasswordHash(userID, string(passwordHash))
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

	respondAppUserAdmin(c, user)
}

func UpdateAppUserStatus(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	req := UpdateAppUserStatusRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	user, err := model.UpdateAppUserStatus(userID, req.Status)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
		case errors.Is(err, model.ErrAppUserStatusInvalid):
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	respondAppUserAdmin(c, user)
}

func DeleteAppUser(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	if _, err := model.UpdateAppUserStatus(userID, model.AppUserStatusDisabled); err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
		case errors.Is(err, model.ErrAppUserStatusInvalid):
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	middleware.SuccessResponse(c, nil)
}

func GetAppUserWallet(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	if _, err := model.GetAppUserByID(userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	wallet, err := model.GetAppUserWalletByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "wallet not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	historicalConsumed, err := model.GetAppWalletHistoricalConsumed(userID)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"wallet": buildAppWalletResponse(wallet, historicalConsumed),
	})
}

func GetAppUserWalletLogs(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	if _, err := model.GetAppUserByID(userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	page, perPage := utils.ParsePageParams(c)
	order := c.DefaultQuery("order", "")

	logs, total, err := model.GetAppWalletLogs(userID, page, perPage, order)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"wallet_logs": buildAppWalletLogResponses(logs),
		"total":       total,
	})
}

func RechargeAppUserBalance(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	req := RechargeAppUserBalanceRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	wallet, rechargeLog, err := model.RechargeAppUserBalance(model.AppUserRechargeParams{
		UserID:     userID,
		Amount:     req.Amount,
		Channel:    req.Channel,
		TradeNo:    req.TradeNo,
		Remark:     req.Remark,
		RawPayload: req.RawPayload,
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
		case errors.Is(err, model.ErrAppRechargeTradeNoExists):
			middleware.ErrorResponse(c, http.StatusConflict, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	historicalConsumed, err := model.GetAppWalletHistoricalConsumed(userID)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"wallet":       buildAppWalletResponse(wallet, historicalConsumed),
		"recharge_log": rechargeLog,
	})
}
