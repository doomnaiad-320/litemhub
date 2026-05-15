package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	Username         string  `json:"username,omitempty"`
	Email            string  `json:"email,omitempty"`
	Phone            string  `json:"phone,omitempty"`
	Status           int     `json:"status"`
	AvailableBalance float64 `json:"available_balance"`
	FrozenBalance    float64 `json:"frozen_balance"`
	CreatedAt        int64   `json:"created_at"`
	UpdatedAt        int64   `json:"updated_at"`
}

type AppRechargeLogResponse struct {
	ID         int     `json:"id"`
	UserID     int     `json:"user_id"`
	UserEmail  string  `json:"user_email,omitempty"`
	UserPhone  string  `json:"user_phone,omitempty"`
	Amount     float64 `json:"amount"`
	Channel    string  `json:"channel,omitempty"`
	TradeNo    string  `json:"trade_no,omitempty"`
	Status     string  `json:"status"`
	RawPayload string  `json:"raw_payload,omitempty"`
	CreatedAt  int64   `json:"created_at"`
	UpdatedAt  int64   `json:"updated_at"`
}

type AdjustAppUserWalletBalanceRequest struct {
	Amount float64 `json:"amount"`
	Remark string  `json:"remark"`
}

type CreateAppUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
	Status   int    `json:"status"`
}

type UpdateAppUserRequest struct {
	Username *string `json:"username"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
}

type ResetAppUserPasswordRequest struct {
	Password string `json:"password"`
}

type UpdateAppUserStatusRequest struct {
	Status int `json:"status"`
}

type UpdateAppUserGroupPriceMultiplierRequest struct {
	Group                   string   `json:"group"`
	PriceMultiplierOverride *float64 `json:"price_multiplier_override"`
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
		Username:  string(user.Username),
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

func buildAppRechargeLogResponse(log *model.AppRechargeLogWithUser) *AppRechargeLogResponse {
	return &AppRechargeLogResponse{
		ID:         log.ID,
		UserID:     log.UserID,
		UserEmail:  string(log.UserEmail),
		UserPhone:  string(log.UserPhone),
		Amount:     log.Amount,
		Channel:    string(log.Channel),
		TradeNo:    string(log.TradeNo),
		Status:     log.Status,
		RawPayload: log.RawPayload,
		CreatedAt:  log.CreatedAt.UnixMilli(),
		UpdatedAt:  log.UpdatedAt.UnixMilli(),
	}
}

func buildAppRechargeLogResponses(logs []*model.AppRechargeLogWithUser) []*AppRechargeLogResponse {
	responses := make([]*AppRechargeLogResponse, len(logs))
	for i, log := range logs {
		responses[i] = buildAppRechargeLogResponse(log)
	}

	return responses
}

func buildAppPaymentOrderResponse(order *model.AppPaymentOrderWithUser) *AppRechargeLogResponse {
	return &AppRechargeLogResponse{
		ID:         order.ID,
		UserID:     order.UserID,
		UserEmail:  string(order.UserEmail),
		UserPhone:  string(order.UserPhone),
		Amount:     order.Amount,
		Channel:    order.Channel,
		TradeNo:    order.AdminTradeNo,
		Status:     order.AdminStatus,
		RawPayload: order.NotifyPayload,
		CreatedAt:  order.AdminCreatedAt.UnixMilli(),
		UpdatedAt:  order.UpdatedAt.UnixMilli(),
	}
}

func buildAppPaymentOrderResponses(orders []*model.AppPaymentOrderWithUser) []*AppRechargeLogResponse {
	responses := make([]*AppRechargeLogResponse, len(orders))
	for i, order := range orders {
		responses[i] = buildAppPaymentOrderResponse(order)
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

func GetAppRechargeLogs(c *gin.Context) {
	page, perPage := utils.ParsePageParams(c)
	order := c.DefaultQuery("order", "")
	userID, _ := strconv.Atoi(c.Query("user_id"))
	keyword := c.Query("keyword")
	channel := c.Query("channel")
	status := c.Query("status")
	startTime, endTime := utils.ParseTimeRange(c, 90*24*time.Hour)

	orders, total, err := model.GetAppPaymentOrders(
		userID,
		keyword,
		channel,
		status,
		startTime,
		endTime,
		page,
		perPage,
		order,
	)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"recharge_logs": buildAppPaymentOrderResponses(orders),
		"total":         total,
	})
}

func GetAppRechargeStats(c *gin.Context) {
	startTime, endTime := utils.ParseTimeRange(c, 30*24*time.Hour)
	keyword := c.Query("keyword")
	granularity := c.DefaultQuery("granularity", "day")

	stats, err := model.GetAppRechargeStats(keyword, startTime, endTime, granularity)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"stats": stats,
	})
}

func CreateAppUser(c *gin.Context) {
	req := CreateAppUserRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Email, req.Phone = normalizeUserAuthAccount(req.Email, req.Phone)
	req.Username = normalizeUserPortalUsername(req.Username)
	if message := validateUserRegisterRequest(req.Username, req.Email, req.Phone, req.Password); message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}
	if req.Username != "" {
		if message := validateUserPortalUsername(req.Username); message != "" {
			middleware.ErrorResponse(c, http.StatusBadRequest, message)
			return
		}
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
		Username:     model.EmptyNullString(req.Username),
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

	if req.Username == nil && req.Email == nil && req.Phone == nil {
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

	username := string(user.Username)
	email := string(user.Email)
	phone := string(user.Phone)
	if req.Username != nil {
		username = strings.TrimSpace(*req.Username)
	}
	if req.Email != nil {
		email = *req.Email
	}
	if req.Phone != nil {
		phone = *req.Phone
	}

	username = normalizeUserPortalUsername(username)
	if username != "" {
		if message := validateUserPortalUsername(username); message != "" {
			middleware.ErrorResponse(c, http.StatusBadRequest, message)
			return
		}
	}
	email, phone = normalizeUserAuthAccount(email, phone)
	user, err = model.UpdateAppUserAccount(userID, username, email, phone)
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

	logs, total, err := model.GetAppWalletLogsByTypes(
		userID,
		page,
		perPage,
		order,
		[]string{model.AppWalletLogTypeRecharge, model.AppWalletLogTypeAdjust},
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

func AdjustAppUserWalletBalance(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	req := AdjustAppUserWalletBalanceRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	wallet, walletLog, err := model.AdjustAppUserWalletBalance(model.AppUserWalletAdjustParams{
		UserID: userID,
		Amount: req.Amount,
		Remark: req.Remark,
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, "user not found")
		case errors.Is(err, model.ErrAppWalletInsufficientBalance),
			errors.Is(err, model.ErrAppWalletAdjustmentAmountInvalid):
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
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
		"wallet":     buildAppWalletResponse(wallet, historicalConsumed),
		"wallet_log": buildAppWalletLogResponse(walletLog),
	})
}

func GetAppUserGroupPriceMultipliers(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	page, perPage := utils.ParsePageParams(c)
	keyword := c.Query("keyword")

	items, total, err := model.GetAppUserGroupPriceMultipliers(userID, keyword, page, perPage)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"groups": items,
		"total":  total,
	})
}

func UpdateAppUserGroupPriceMultiplier(c *gin.Context) {
	userID, ok := parseAppUserID(c)
	if !ok {
		return
	}

	req := UpdateAppUserGroupPriceMultiplierRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	if req.Group == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "group is required")
		return
	}

	if req.PriceMultiplierOverride != nil && *req.PriceMultiplierOverride < 0 {
		middleware.ErrorResponse(
			c,
			http.StatusBadRequest,
			"price multiplier override must be greater than or equal to 0",
		)
		return
	}

	err := model.SetAppUserGroupPriceMultiplierOverride(
		userID,
		req.Group,
		req.PriceMultiplierOverride,
	)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"user_id":                   userID,
		"group":                     req.Group,
		"price_multiplier_override": req.PriceMultiplierOverride,
	})
}
