package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/labring/aiproxy/core/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ErrAppUserWalletNotFound        = "app_user_wallet"
	ErrAppWalletReservationNotFound = "app_wallet_reservation"
)

var (
	ErrAppRechargeTradeNoExists        = errors.New("trade no already exists")
	ErrAppWalletInsufficientBalance    = errors.New("wallet balance not enough")
	ErrAppWalletReservationInvalid     = errors.New("wallet reservation is invalid")
	ErrAppWalletReservationDuplicated  = errors.New("wallet reservation already exists")
	ErrAppWalletBalanceStateUnexpected = errors.New("wallet balance state is invalid")
)

type AppUserRechargeParams struct {
	UserID     int
	Amount     float64
	Channel    string
	TradeNo    string
	RawPayload string
	Remark     string
}

type AppRechargeLogWithUser struct {
	AppRechargeLog
	UserEmail EmptyNullString `json:"user_email"`
	UserPhone EmptyNullString `json:"user_phone"`
}

type AppRechargeStatsPoint struct {
	Timestamp int64   `json:"timestamp"`
	Channel   string  `json:"channel,omitempty"`
	Amount    float64 `json:"amount"`
	Count     int64   `json:"count"`
}

type AppRechargeStats struct {
	Granularity string                  `json:"granularity"`
	TotalAmount float64                 `json:"total_amount"`
	TotalCount  int64                   `json:"total_count"`
	PaidAmount  float64                 `json:"paid_amount"`
	PaidCount   int64                   `json:"paid_count"`
	ByChannel   []AppRechargeStatsPoint `json:"by_channel,omitempty" gorm:"-"`
	TimeSeries  []AppRechargeStatsPoint `json:"time_series"`
}

type AppUserReserveBalanceParams struct {
	RequestID string
	UserID    int
	TokenID   int
	GroupID   string
	Model     string
	Amount    float64
	ExpiresAt time.Time
	Remark    string
}

func getAppUserOrder(order string) string {
	prefix, suffix, _ := strings.Cut(order, "-")
	switch prefix {
	case "id", "created_at", "updated_at", "status":
		switch suffix {
		case "asc":
			return prefix + " asc"
		default:
			return prefix + " desc"
		}
	default:
		return "id desc"
	}
}

func getAppWalletLogOrder(order string) string {
	prefix, suffix, _ := strings.Cut(order, "-")
	switch prefix {
	case "id", "created_at":
		switch suffix {
		case "asc":
			return prefix + " asc"
		default:
			return prefix + " desc"
		}
	default:
		return "id desc"
	}
}

func getAppRechargeLogOrder(order string) string {
	prefix, suffix, _ := strings.Cut(order, "-")
	switch prefix {
	case "id", "created_at", "updated_at", "amount":
		switch suffix {
		case "asc":
			return "app_recharge_log." + prefix + " asc"
		default:
			return "app_recharge_log." + prefix + " desc"
		}
	default:
		return "app_recharge_log.id desc"
	}
}

func GetAppUsers(keyword string, page, perPage int, order string, status int) (
	users []*AppUser,
	total int64,
	err error,
) {
	tx := DB.Model(&AppUser{})

	if status != 0 {
		tx = tx.Where("status = ?", status)
	}

	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		if id := String2Int(keyword); id > 0 {
			tx = tx.Where(
				DB.Where("id = ?", id).
					Or("email LIKE ?", likeKeyword).
					Or("phone LIKE ?", likeKeyword),
			)
		} else {
			tx = tx.Where("email LIKE ? OR phone LIKE ?", likeKeyword, likeKeyword)
		}
	}

	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.Order(getAppUserOrder(order)).Limit(limit).Offset(offset).Find(&users).Error

	return users, total, err
}

func GetAppUserWalletByUserID(userID int) (*AppUserWallet, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	var wallet AppUserWallet
	err := DB.Where("user_id = ?", userID).First(&wallet).Error

	return &wallet, HandleNotFound(err, ErrAppUserWalletNotFound)
}

func GetAppWalletHistoricalConsumed(userID int) (float64, error) {
	if userID == 0 {
		return 0, errors.New("user id is empty")
	}

	var total float64
	err := DB.
		Model(&AppWalletLog{}).
		Where("user_id = ? AND type = ?", userID, AppWalletLogTypeSettle).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&total).Error

	return total, err
}

func GetAppRechargeLogs(
	userID int,
	keyword string,
	channel string,
	status string,
	startTime time.Time,
	endTime time.Time,
	page int,
	perPage int,
	order string,
) (logs []*AppRechargeLogWithUser, total int64, err error) {
	tx := appRechargeLogQuery(userID, keyword, channel, status, startTime, endTime)
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.
		Select("app_recharge_log.*, app_user.email AS user_email, app_user.phone AS user_phone").
		Order(getAppRechargeLogOrder(order)).
		Limit(limit).
		Offset(offset).
		Find(&logs).Error

	return logs, total, err
}

func appRechargeLogQuery(
	userID int,
	keyword string,
	channel string,
	status string,
	startTime time.Time,
	endTime time.Time,
) *gorm.DB {
	tx := DB.Model(&AppRechargeLog{}).
		Joins("LEFT JOIN app_user ON app_user.id = app_recharge_log.user_id")
	if userID > 0 {
		tx = tx.Where("app_recharge_log.user_id = ?", userID)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		if id := String2Int(keyword); id > 0 {
			tx = tx.Where(
				DB.Where("app_recharge_log.user_id = ?", id).
					Or("app_user.email LIKE ?", likeKeyword).
					Or("app_user.phone LIKE ?", likeKeyword),
			)
		} else {
			tx = tx.Where("app_user.email LIKE ? OR app_user.phone LIKE ?", likeKeyword, likeKeyword)
		}
	}
	channel = strings.TrimSpace(channel)
	if channel != "" {
		tx = tx.Where("app_recharge_log.channel = ?", channel)
	}
	status = strings.TrimSpace(status)
	if status != "" {
		tx = tx.Where("app_recharge_log.status = ?", status)
	}
	if !startTime.IsZero() {
		tx = tx.Where("app_recharge_log.created_at >= ?", startTime)
	}
	if !endTime.IsZero() {
		tx = tx.Where("app_recharge_log.created_at <= ?", endTime)
	}

	return tx
}

func GetAppRechargeStats(
	keyword string,
	startTime time.Time,
	endTime time.Time,
	granularity string,
) (*AppRechargeStats, error) {
	granularity = normalizeAppRechargeStatsGranularity(granularity)
	baseQuery := func() *gorm.DB {
		return appRechargeLogQuery(0, keyword, "", "", startTime, endTime)
	}

	stats := &AppRechargeStats{Granularity: granularity}
	if err := baseQuery().
		Select(
			"COALESCE(SUM(app_recharge_log.amount), 0) AS total_amount, COUNT(*) AS total_count, "+
				"COALESCE(SUM(CASE WHEN app_recharge_log.status = ? THEN app_recharge_log.amount ELSE 0 END), 0) AS paid_amount, "+
				"COALESCE(SUM(CASE WHEN app_recharge_log.status = ? THEN 1 ELSE 0 END), 0) AS paid_count",
			AppRechargeStatusPaid,
			AppRechargeStatusPaid,
		).
		Scan(stats).Error; err != nil {
		return nil, err
	}

	channelRows := []struct {
		Channel EmptyNullString
		Amount  float64
		Count   int64
	}{}
	if err := baseQuery().
		Select("COALESCE(app_recharge_log.channel, '') AS channel, COALESCE(SUM(app_recharge_log.amount), 0) AS amount, COUNT(*) AS count").
		Where("app_recharge_log.status = ?", AppRechargeStatusPaid).
		Group("app_recharge_log.channel").
		Order("amount desc").
		Scan(&channelRows).Error; err != nil {
		return nil, err
	}

	stats.ByChannel = make([]AppRechargeStatsPoint, 0, len(channelRows))
	for _, row := range channelRows {
		stats.ByChannel = append(stats.ByChannel, AppRechargeStatsPoint{
			Timestamp: 0,
			Channel:   string(row.Channel),
			Amount:    row.Amount,
			Count:     row.Count,
		})
	}

	paidLogs := []struct {
		Amount    float64
		CreatedAt time.Time
	}{}
	if err := baseQuery().
		Select("app_recharge_log.amount, app_recharge_log.created_at").
		Where("app_recharge_log.status = ?", AppRechargeStatusPaid).
		Order("app_recharge_log.created_at asc").
		Scan(&paidLogs).Error; err != nil {
		return nil, err
	}

	stats.TimeSeries = buildAppRechargeTimeSeries(startTime, endTime, granularity, paidLogs)

	return stats, nil
}

func normalizeAppRechargeStatsGranularity(granularity string) string {
	switch strings.ToLower(strings.TrimSpace(granularity)) {
	case "week", "month":
		return strings.ToLower(strings.TrimSpace(granularity))
	default:
		return "day"
	}
}

func buildAppRechargeTimeSeries(
	startTime time.Time,
	endTime time.Time,
	granularity string,
	paidLogs []struct {
		Amount    float64
		CreatedAt time.Time
	},
) []AppRechargeStatsPoint {
	pointsByDate := make(map[string]*AppRechargeStatsPoint)
	for _, log := range paidLogs {
		bucket := beginningOfRechargeBucket(log.CreatedAt, granularity)
		key := bucket.Format(time.DateOnly)
		point := pointsByDate[key]
		if point == nil {
			point = &AppRechargeStatsPoint{Timestamp: bucket.UnixMilli()}
			pointsByDate[key] = point
		}

		point.Amount += log.Amount
		point.Count++
	}

	if startTime.IsZero() || endTime.IsZero() {
		points := make([]AppRechargeStatsPoint, 0, len(pointsByDate))
		for _, point := range pointsByDate {
			points = append(points, *point)
		}

		return points
	}

	startBucket := beginningOfRechargeBucket(startTime, granularity)
	endBucket := beginningOfRechargeBucket(endTime, granularity)
	if endBucket.Before(startBucket) {
		return []AppRechargeStatsPoint{}
	}

	points := make([]AppRechargeStatsPoint, 0)
	for bucket := startBucket; !bucket.After(endBucket); bucket = nextRechargeBucket(bucket, granularity) {
		key := bucket.Format(time.DateOnly)
		if point := pointsByDate[key]; point != nil {
			points = append(points, *point)
			continue
		}

		points = append(points, AppRechargeStatsPoint{Timestamp: bucket.UnixMilli()})
	}

	return points
}

func beginningOfRechargeBucket(value time.Time, granularity string) time.Time {
	local := value.In(time.Local)
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.Local)

	switch granularity {
	case "week":
		weekday := int(day.Weekday())
		if weekday == 0 {
			weekday = 7
		}

		return day.AddDate(0, 0, -(weekday - 1))
	case "month":
		return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, time.Local)
	default:
		return day
	}
}

func nextRechargeBucket(value time.Time, granularity string) time.Time {
	switch granularity {
	case "week":
		return value.AddDate(0, 0, 7)
	case "month":
		return value.AddDate(0, 1, 0)
	default:
		return value.AddDate(0, 0, 1)
	}
}

func GetAppUserWalletsByUserIDs(userIDs []int) (map[int]*AppUserWallet, error) {
	if len(userIDs) == 0 {
		return map[int]*AppUserWallet{}, nil
	}

	wallets := make([]*AppUserWallet, 0, len(userIDs))
	if err := DB.Where("user_id IN (?)", userIDs).Find(&wallets).Error; err != nil {
		return nil, err
	}

	walletMap := make(map[int]*AppUserWallet, len(wallets))
	for _, wallet := range wallets {
		walletMap[wallet.UserID] = wallet
	}

	return walletMap, nil
}

func GetAppWalletLogs(userID, page, perPage int, order string) (
	logs []*AppWalletLog,
	total int64,
	err error,
) {
	return getAppWalletLogs(userID, page, perPage, order, nil)
}

func GetAppWalletLogsByTypes(userID, page, perPage int, order string, logTypes []string) (
	logs []*AppWalletLog,
	total int64,
	err error,
) {
	return getAppWalletLogs(userID, page, perPage, order, logTypes)
}

func getAppWalletLogs(userID, page, perPage int, order string, logTypes []string) (
	logs []*AppWalletLog,
	total int64,
	err error,
) {
	if userID == 0 {
		return nil, 0, errors.New("user id is empty")
	}

	tx := DB.Model(&AppWalletLog{}).Where("user_id = ?", userID)
	if len(logTypes) > 0 {
		tx = tx.Where("type IN ?", logTypes)
	}

	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.Order(getAppWalletLogOrder(order)).Limit(limit).Offset(offset).Find(&logs).Error

	return logs, total, err
}

func GetAppWalletReservationByID(id int) (*AppWalletReservation, error) {
	if id == 0 {
		return nil, errors.New("reservation id is empty")
	}

	var reservation AppWalletReservation
	err := DB.Where("id = ?", id).First(&reservation).Error

	return &reservation, HandleNotFound(err, ErrAppWalletReservationNotFound)
}

func GetAppWalletReservationByRequestID(requestID string) (*AppWalletReservation, error) {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return nil, errors.New("request id is empty")
	}

	var reservation AppWalletReservation
	err := DB.Where("request_id = ?", requestID).First(&reservation).Error

	return &reservation, HandleNotFound(err, ErrAppWalletReservationNotFound)
}

func RechargeAppUserBalance(params AppUserRechargeParams) (
	wallet *AppUserWallet,
	rechargeLog *AppRechargeLog,
	err error,
) {
	if params.UserID == 0 {
		return nil, nil, errors.New("user id is empty")
	}

	if params.Amount <= 0 {
		return nil, nil, errors.New("amount must be greater than zero")
	}

	if _, err = GetAppUserByID(params.UserID); err != nil {
		return nil, nil, err
	}

	channel := strings.TrimSpace(params.Channel)
	if channel == "" {
		channel = "manual"
	}

	tradeNo := strings.TrimSpace(params.TradeNo)
	if tradeNo == "" {
		tradeNo = "manual_" + common.ShortUUID()
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		params.Channel = channel
		params.TradeNo = tradeNo
		wallet, rechargeLog, err = rechargeAppUserBalanceWithTx(tx, params)

		return err
	})

	return wallet, rechargeLog, err
}

func rechargeAppUserBalanceWithTx(
	tx *gorm.DB,
	params AppUserRechargeParams,
) (wallet *AppUserWallet, rechargeLog *AppRechargeLog, err error) {
	wallet = &AppUserWallet{}
	rechargeLog = &AppRechargeLog{}

	if err := tx.
		Where("user_id = ?", params.UserID).
		Attrs(AppUserWallet{UserID: params.UserID}).
		FirstOrCreate(wallet).Error; err != nil {
		return nil, nil, err
	}

	result := tx.
		Model(wallet).
		Clauses(clause.Returning{
			Columns: []clause.Column{
				{Name: "available_balance"},
				{Name: "updated_at"},
			},
		}).
		Where("id = ?", wallet.ID).
		Update("available_balance", gorm.Expr("available_balance + ?", params.Amount))
	if err := HandleUpdateResult(result, ErrAppUserWalletNotFound); err != nil {
		return nil, nil, err
	}

	*rechargeLog = AppRechargeLog{
		UserID:     params.UserID,
		Amount:     params.Amount,
		Channel:    EmptyNullString(params.Channel),
		TradeNo:    EmptyNullString(params.TradeNo),
		Status:     AppRechargeStatusPaid,
		RawPayload: params.RawPayload,
	}

	if err := tx.Create(rechargeLog).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, nil, ErrAppRechargeTradeNoExists
		}

		return nil, nil, err
	}

	balanceAfter := wallet.AvailableBalance
	balanceBefore := balanceAfter - params.Amount

	walletLog := &AppWalletLog{
		UserID:        params.UserID,
		Type:          AppWalletLogTypeRecharge,
		Amount:        params.Amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  balanceAfter,
		Remark:        params.Remark,
	}

	if err := tx.Create(walletLog).Error; err != nil {
		return nil, nil, err
	}

	return wallet, rechargeLog, nil
}

func ReserveAppUserBalance(params AppUserReserveBalanceParams) (
	wallet *AppUserWallet,
	reservation *AppWalletReservation,
	err error,
) {
	if params.UserID == 0 {
		return nil, nil, errors.New("user id is empty")
	}

	params.RequestID = strings.TrimSpace(params.RequestID)
	if params.RequestID == "" {
		return nil, nil, errors.New("request id is empty")
	}

	if params.Amount <= 0 {
		return nil, nil, errors.New("amount must be greater than zero")
	}

	if params.ExpiresAt.IsZero() {
		params.ExpiresAt = time.Now().Add(30 * time.Minute)
	}

	wallet = &AppUserWallet{}
	reservation = &AppWalletReservation{}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Where("user_id = ?", params.UserID).
			Attrs(AppUserWallet{UserID: params.UserID}).
			FirstOrCreate(wallet).Error; err != nil {
			return err
		}

		result := tx.
			Model(wallet).
			Clauses(clause.Returning{
				Columns: []clause.Column{
					{Name: "available_balance"},
					{Name: "frozen_balance"},
					{Name: "updated_at"},
				},
			}).
			Where("id = ? AND available_balance >= ?", wallet.ID, params.Amount).
			Updates(map[string]any{
				"available_balance": gorm.Expr("available_balance - ?", params.Amount),
				"frozen_balance":    gorm.Expr("frozen_balance + ?", params.Amount),
			})
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			return ErrAppWalletInsufficientBalance
		}

		*reservation = AppWalletReservation{
			RequestID:      EmptyNullString(params.RequestID),
			UserID:         params.UserID,
			TokenID:        params.TokenID,
			GroupID:        params.GroupID,
			Model:          params.Model,
			ReservedAmount: params.Amount,
			Status:         AppWalletReservationStatusHeld,
			Reason:         params.Remark,
			ExpiresAt:      params.ExpiresAt,
		}

		if err := tx.Create(reservation).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return ErrAppWalletReservationDuplicated
			}

			return err
		}

		balanceAfter := wallet.AvailableBalance
		balanceBefore := walletAmountAdd(balanceAfter, params.Amount)

		return tx.Create(&AppWalletLog{
			UserID:        params.UserID,
			Type:          AppWalletLogTypeReserve,
			Amount:        params.Amount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			RequestID:     EmptyNullString(params.RequestID),
			ReservationID: reservation.ID,
			Remark:        params.Remark,
		}).Error
	})

	return wallet, reservation, err
}

func ReleaseAppUserReservation(
	reservationID int,
	reason string,
) (wallet *AppUserWallet, reservation *AppWalletReservation, err error) {
	if reservationID == 0 {
		return nil, nil, errors.New("reservation id is empty")
	}

	wallet = &AppUserWallet{}
	reservation = &AppWalletReservation{}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", reservationID).
			First(reservation).Error; err != nil {
			return HandleNotFound(err, ErrAppWalletReservationNotFound)
		}

		if reservation.Status != AppWalletReservationStatusHeld {
			return ErrAppWalletReservationInvalid
		}

		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", reservation.UserID).
			First(wallet).Error; err != nil {
			return HandleNotFound(err, ErrAppUserWalletNotFound)
		}

		if wallet.FrozenBalance < reservation.ReservedAmount {
			return ErrAppWalletBalanceStateUnexpected
		}

		result := tx.
			Model(wallet).
			Clauses(clause.Returning{
				Columns: []clause.Column{
					{Name: "available_balance"},
					{Name: "frozen_balance"},
					{Name: "updated_at"},
				},
			}).
			Where("id = ?", wallet.ID).
			Updates(map[string]any{
				"available_balance": gorm.Expr("available_balance + ?", reservation.ReservedAmount),
				"frozen_balance":    gorm.Expr("frozen_balance - ?", reservation.ReservedAmount),
			})
		if err := HandleUpdateResult(result, ErrAppUserWalletNotFound); err != nil {
			return err
		}

		reservation.Status = AppWalletReservationStatusReleased
		reservation.ActualAmount = 0
		reservation.Reason = reason
		result = tx.Model(reservation).
			Where("id = ? AND status = ?", reservation.ID, AppWalletReservationStatusHeld).
			Updates(map[string]any{
				"status":        reservation.Status,
				"actual_amount": reservation.ActualAmount,
				"reason":        reservation.Reason,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppWalletReservationInvalid
		}

		balanceAfter := wallet.AvailableBalance
		balanceBefore := walletAmountSub(balanceAfter, reservation.ReservedAmount)

		return tx.Create(&AppWalletLog{
			UserID:        reservation.UserID,
			Type:          AppWalletLogTypeRelease,
			Amount:        reservation.ReservedAmount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			RequestID:     reservation.RequestID,
			ReservationID: reservation.ID,
			Remark:        reason,
		}).Error
	})

	return wallet, reservation, err
}

func SettleAppUserReservation(
	reservationID int,
	actualAmount float64,
	reason string,
) (wallet *AppUserWallet, reservation *AppWalletReservation, err error) {
	if reservationID == 0 {
		return nil, nil, errors.New("reservation id is empty")
	}

	if actualAmount < 0 {
		actualAmount = 0
	}

	wallet = &AppUserWallet{}
	reservation = &AppWalletReservation{}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", reservationID).
			First(reservation).Error; err != nil {
			return HandleNotFound(err, ErrAppWalletReservationNotFound)
		}

		if reservation.Status != AppWalletReservationStatusHeld {
			return ErrAppWalletReservationInvalid
		}

		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ?", reservation.UserID).
			First(wallet).Error; err != nil {
			return HandleNotFound(err, ErrAppUserWalletNotFound)
		}

		if wallet.FrozenBalance < reservation.ReservedAmount {
			return ErrAppWalletBalanceStateUnexpected
		}

		extraAmount := walletAmountSub(actualAmount, reservation.ReservedAmount)
		refundAmount := walletAmountSub(reservation.ReservedAmount, actualAmount)
		if extraAmount > 0 && wallet.AvailableBalance < extraAmount {
			return ErrAppWalletInsufficientBalance
		}

		updates := map[string]any{
			"frozen_balance": gorm.Expr("frozen_balance - ?", reservation.ReservedAmount),
		}
		balanceBefore := wallet.AvailableBalance

		switch {
		case extraAmount > 0:
			updates["available_balance"] = gorm.Expr("available_balance - ?", extraAmount)
		case refundAmount > 0:
			updates["available_balance"] = gorm.Expr("available_balance + ?", refundAmount)
		default:
			updates["available_balance"] = gorm.Expr("available_balance")
		}

		result := tx.
			Model(wallet).
			Clauses(clause.Returning{
				Columns: []clause.Column{
					{Name: "available_balance"},
					{Name: "frozen_balance"},
					{Name: "updated_at"},
				},
			}).
			Where("id = ?", wallet.ID).
			Updates(updates)
		if err := HandleUpdateResult(result, ErrAppUserWalletNotFound); err != nil {
			return err
		}

		if extraAmount > 0 {
			balanceBefore = walletAmountAdd(wallet.AvailableBalance, extraAmount)
		} else if refundAmount > 0 {
			balanceBefore = walletAmountSub(wallet.AvailableBalance, refundAmount)
		}

		reservation.Status = AppWalletReservationStatusSettled
		reservation.ActualAmount = actualAmount
		reservation.Reason = buildAppWalletSettleReason(reason, reservation.ReservedAmount, actualAmount)
		result = tx.Model(reservation).
			Where("id = ? AND status = ?", reservation.ID, AppWalletReservationStatusHeld).
			Updates(map[string]any{
				"status":        reservation.Status,
				"actual_amount": reservation.ActualAmount,
				"reason":        reservation.Reason,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppWalletReservationInvalid
		}

		return tx.Create(&AppWalletLog{
			UserID:        reservation.UserID,
			Type:          AppWalletLogTypeSettle,
			Amount:        actualAmount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  wallet.AvailableBalance,
			RequestID:     reservation.RequestID,
			ReservationID: reservation.ID,
			Remark:        reservation.Reason,
		}).Error
	})

	return wallet, reservation, err
}

func FailAppUserReservation(
	reservationID int,
	actualAmount float64,
	reason string,
) (*AppWalletReservation, error) {
	if reservationID == 0 {
		return nil, errors.New("reservation id is empty")
	}

	if actualAmount < 0 {
		actualAmount = 0
	}

	reservation := &AppWalletReservation{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", reservationID).
			First(reservation).Error; err != nil {
			return HandleNotFound(err, ErrAppWalletReservationNotFound)
		}

		if reservation.Status != AppWalletReservationStatusHeld {
			return ErrAppWalletReservationInvalid
		}

		reservation.Status = AppWalletReservationStatusFailed
		reservation.ActualAmount = actualAmount
		reservation.Reason = reason

		result := tx.Model(reservation).
			Where("id = ? AND status = ?", reservation.ID, AppWalletReservationStatusHeld).
			Updates(map[string]any{
				"status":        reservation.Status,
				"actual_amount": reservation.ActualAmount,
				"reason":        reservation.Reason,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppWalletReservationInvalid
		}

		return nil
	})

	return reservation, err
}

func walletAmountAdd(a, b float64) float64 {
	return decimal.NewFromFloat(a).Add(decimal.NewFromFloat(b)).InexactFloat64()
}

func walletAmountSub(a, b float64) float64 {
	return decimal.NewFromFloat(a).Sub(decimal.NewFromFloat(b)).InexactFloat64()
}

func buildAppWalletSettleReason(reason string, reservedAmount, actualAmount float64) string {
	summary := fmt.Sprintf(
		"reserved=%.8f, actual=%.8f",
		reservedAmount,
		actualAmount,
	)
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return summary
	}

	return reason + "; " + summary
}
