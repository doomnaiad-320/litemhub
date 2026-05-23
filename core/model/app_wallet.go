package model

import (
	"errors"
	"fmt"
	"math"
	"sort"
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

const (
	AppReferralStatusInvited   = "invited"
	AppReferralStatusRecharged = "recharged"
)

var (
	ErrAppRechargeTradeNoExists         = errors.New("trade no already exists")
	ErrAppWalletInsufficientBalance     = errors.New("wallet balance not enough")
	ErrAppWalletReservationInvalid      = errors.New("wallet reservation is invalid")
	ErrAppWalletReservationDuplicated   = errors.New("wallet reservation already exists")
	ErrAppWalletBalanceStateUnexpected  = errors.New("wallet balance state is invalid")
	ErrAppWalletAdjustmentAmountInvalid = errors.New(
		"wallet adjustment amount must be a non-zero finite number",
	)
)

type AppUserRechargeParams struct {
	UserID     int
	Amount     float64
	Channel    string
	TradeNo    string
	RawPayload string
	Remark     string
}

type AppUserRebateParams struct {
	UserID       int
	Amount       float64
	SourceUserID int
	OrderNo      string
	DiscountCode string
}

type AppUserWalletAdjustParams struct {
	UserID int
	Amount float64
	Remark string
}

type AppRechargeLogWithUser struct {
	AppRechargeLog
	UserEmail EmptyNullString `json:"user_email"`
	UserPhone EmptyNullString `json:"user_phone"`
}

type AppPaymentOrderWithUser struct {
	AppPaymentOrder
	UserEmail      EmptyNullString `json:"user_email"`
	UserPhone      EmptyNullString `json:"user_phone"`
	AdminStatus    string          `json:"admin_status"`
	AdminCreatedAt time.Time       `json:"admin_created_at"`
}

type AppWalletLogDetail struct {
	OutTradeNo     string
	TradeNo        string
	PayAmount      float64
	DiscountAmount float64
	DiscountCode   string
	Channel        string
	PayType        string
	PaidAt         *time.Time
}

type AppWalletLogWithDetail struct {
	AppWalletLog
	Detail *AppWalletLogDetail `gorm:"-"`
}

type AppReferralRecord struct {
	ID               int             `json:"id"`
	InvitedUserID    int             `json:"invited_user_id"`
	InvitedUserEmail EmptyNullString `json:"invited_user_email"`
	InvitedUserPhone EmptyNullString `json:"invited_user_phone"`
	DiscountCode     EmptyNullString `json:"discount_code"`
	OrderCount       int             `json:"order_count"`
	OrderNo          string          `json:"order_no"`
	Amount           float64         `json:"amount"`
	PayAmount        float64         `json:"pay_amount"`
	RebateAmount     float64         `json:"rebate_amount"`
	Status           string          `json:"status"`
	CreatedAt        time.Time       `json:"created_at"`
	PaidAt           *time.Time      `json:"paid_at"`
}

type AppReferralStats struct {
	InvitedUserCount  int     `json:"invited_user_count"`
	TotalRebateAmount float64 `json:"total_rebate_amount"`
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
	TimeSeries  []AppRechargeStatsPoint `json:"time_series"        gorm:"-"`
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

func getAppPaymentOrderOrder(order string) string {
	prefix, suffix, _ := strings.Cut(order, "-")
	switch prefix {
	case "id", "updated_at", "amount":
		column := "recharge_orders." + prefix
		switch suffix {
		case "asc":
			return column + " asc"
		default:
			return column + " desc"
		}
	case "created_at":
		column := "recharge_orders.admin_created_at"
		switch suffix {
		case "asc":
			return column + " asc"
		default:
			return column + " desc"
		}
	default:
		return "recharge_orders.admin_created_at desc, recharge_orders.id desc"
	}
}

func getAppReferralRecordOrder(order string) string {
	switch strings.ToLower(strings.TrimSpace(order)) {
	case "id-asc":
		return "app_user.id asc"
	case "amount-desc":
		return "amount desc, app_user.id desc"
	case "amount-asc":
		return "amount asc, app_user.id asc"
	case "rebate-desc":
		return "rebate_amount desc, app_user.id desc"
	case "rebate-asc":
		return "rebate_amount asc, app_user.id asc"
	case "created_at-asc":
		return "created_at asc, app_user.id asc"
	default:
		return "COALESCE(paid_at, created_at) desc, app_user.id desc"
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
					Or("username LIKE ?", likeKeyword).
					Or("email LIKE ?", likeKeyword).
					Or("phone LIKE ?", likeKeyword),
			)
		} else {
			tx = tx.Where("username LIKE ? OR email LIKE ? OR phone LIKE ?", likeKeyword, likeKeyword, likeKeyword)
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

func GetAppPaymentOrders(
	userID int,
	keyword string,
	channel string,
	status string,
	startTime time.Time,
	endTime time.Time,
	page int,
	perPage int,
	order string,
) (orders []*AppPaymentOrderWithUser, total int64, err error) {
	tx := appPaymentOrderQuery(userID, keyword, channel, status, startTime, endTime)
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.
		Select(appPaymentOrderSelectSQL()).
		Order(getAppPaymentOrderOrder(order)).
		Limit(limit).
		Offset(offset).
		Find(&orders).Error

	return orders, total, err
}

func GetAppReferralRecordsByRebateUserID(
	rebateUserID int,
	page int,
	perPage int,
	order string,
) (records []*AppReferralRecord, total int64, err error) {
	if rebateUserID == 0 {
		return nil, 0, errors.New("rebate user id is empty")
	}

	type appReferralUserRow struct {
		ID               int
		InvitedUserID    int
		InvitedUserEmail EmptyNullString
		InvitedUserPhone EmptyNullString
		DiscountCode     EmptyNullString
		CreatedAt        time.Time
	}

	referralRows := make([]*appReferralUserRow, 0)
	if err = DB.
		Model(&AppUserReferral{}).
		Select(
			"app_user_referral.id, app_user_referral.invited_user_id, "+
				"app_user.email AS invited_user_email, app_user.phone AS invited_user_phone, "+
				"app_user_referral.discount_code, app_user_referral.created_at",
		).
		Joins("LEFT JOIN app_user ON app_user.id = app_user_referral.invited_user_id").
		Where("app_user_referral.inviter_user_id = ?", rebateUserID).
		Find(&referralRows).Error; err != nil {
		return nil, 0, err
	}

	paymentUserIDs := make([]int, 0)
	if err = DB.
		Model(&AppPaymentOrder{}).
		Distinct("user_id").
		Where("rebate_user_id = ?", rebateUserID).
		Where("status = ?", AppPaymentStatusPaid).
		Pluck("user_id", &paymentUserIDs).Error; err != nil {
		return nil, 0, err
	}

	userIDSet := make(map[int]struct{}, len(referralRows)+len(paymentUserIDs))
	for _, row := range referralRows {
		if row != nil && row.InvitedUserID > 0 {
			userIDSet[row.InvitedUserID] = struct{}{}
		}
	}
	for _, userID := range paymentUserIDs {
		if userID > 0 {
			userIDSet[userID] = struct{}{}
		}
	}

	total = int64(len(userIDSet))
	if total <= 0 {
		return nil, 0, nil
	}

	userIDs := make([]int, 0, len(userIDSet))
	for userID := range userIDSet {
		userIDs = append(userIDs, userID)
	}

	users := make([]*AppUser, 0, len(userIDs))
	if err = DB.Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	userMap := make(map[int]*AppUser, len(users))
	for _, user := range users {
		userMap[user.ID] = user
	}

	referralMap := make(map[int]*appReferralUserRow, len(referralRows))
	for _, row := range referralRows {
		if row != nil {
			referralMap[row.InvitedUserID] = row
		}
	}

	records = make([]*AppReferralRecord, 0, len(userIDs))
	for _, userID := range userIDs {
		user := userMap[userID]
		if user == nil {
			continue
		}

		record := &AppReferralRecord{
			ID:               user.ID,
			InvitedUserID:    user.ID,
			InvitedUserEmail: user.Email,
			InvitedUserPhone: user.Phone,
			Status:           AppReferralStatusInvited,
			CreatedAt:        user.CreatedAt,
		}
		if referral := referralMap[userID]; referral != nil {
			record.ID = referral.ID
			record.DiscountCode = referral.DiscountCode
			record.CreatedAt = referral.CreatedAt
		}

		orders := make([]*AppPaymentOrder, 0)
		if err = DB.
			Where("rebate_user_id = ?", rebateUserID).
			Where("user_id = ?", userID).
			Where("status = ?", AppPaymentStatusPaid).
			Order("COALESCE(paid_at, created_at) desc, id desc").
			Find(&orders).Error; err != nil {
			return nil, 0, err
		}
		if len(orders) > 0 {
			record.Status = AppReferralStatusRecharged
			record.OrderCount = len(orders)
			record.OrderNo = orders[0].OutTradeNo
			record.PaidAt = orders[0].PaidAt
			if record.PaidAt == nil {
				record.PaidAt = &orders[0].CreatedAt
			}
			if record.CreatedAt.IsZero() {
				record.CreatedAt = orders[len(orders)-1].CreatedAt
			}
			if record.DiscountCode == "" {
				record.DiscountCode = orders[0].DiscountCode
			}
			for _, order := range orders {
				record.Amount += order.Amount
				record.PayAmount += order.ExpectedPayAmount()
				record.RebateAmount += order.RebateAmount
			}
			record.Amount = normalizeMoney(record.Amount)
			record.PayAmount = normalizeMoney(record.PayAmount)
			record.RebateAmount = normalizeMoney(record.RebateAmount)
		}

		records = append(records, record)
	}

	sortAppReferralRecords(records, order)

	limit, offset := toLimitOffset(page, perPage)
	if offset >= len(records) {
		return []*AppReferralRecord{}, total, nil
	}
	end := min(offset+limit, len(records))

	return records[offset:end], total, nil
}

func sortAppReferralRecords(records []*AppReferralRecord, order string) {
	sort.SliceStable(records, func(i, j int) bool {
		left := records[i]
		right := records[j]
		switch strings.ToLower(strings.TrimSpace(order)) {
		case "id-asc":
			return left.ID < right.ID
		case "amount-desc":
			return left.Amount > right.Amount || (left.Amount == right.Amount && left.ID > right.ID)
		case "amount-asc":
			return left.Amount < right.Amount || (left.Amount == right.Amount && left.ID < right.ID)
		case "rebate-desc":
			return left.RebateAmount > right.RebateAmount || (left.RebateAmount == right.RebateAmount && left.ID > right.ID)
		case "rebate-asc":
			return left.RebateAmount < right.RebateAmount || (left.RebateAmount == right.RebateAmount && left.ID < right.ID)
		case "created_at-asc":
			return left.CreatedAt.Before(right.CreatedAt) || (left.CreatedAt.Equal(right.CreatedAt) && left.ID < right.ID)
		default:
			leftTime := left.CreatedAt
			if left.PaidAt != nil {
				leftTime = *left.PaidAt
			}
			rightTime := right.CreatedAt
			if right.PaidAt != nil {
				rightTime = *right.PaidAt
			}

			return leftTime.After(rightTime) || (leftTime.Equal(rightTime) && left.ID > right.ID)
		}
	})
}

func GetAppReferralStatsByRebateUserID(rebateUserID int) (*AppReferralStats, error) {
	if rebateUserID == 0 {
		return nil, errors.New("rebate user id is empty")
	}

	referralUserIDs := make([]int, 0)
	if err := DB.
		Model(&AppUserReferral{}).
		Select("invited_user_id").
		Where("inviter_user_id = ?", rebateUserID).
		Pluck("invited_user_id", &referralUserIDs).Error; err != nil {
		return nil, err
	}

	rebateUserIDs := make([]int, 0)
	if err := DB.
		Model(&AppPaymentOrder{}).
		Distinct("user_id").
		Where("rebate_user_id = ?", rebateUserID).
		Where("status = ?", AppPaymentStatusPaid).
		Pluck("user_id", &rebateUserIDs).Error; err != nil {
		return nil, err
	}

	userIDSet := make(map[int]struct{}, len(referralUserIDs)+len(rebateUserIDs))
	for _, userID := range referralUserIDs {
		if userID > 0 {
			userIDSet[userID] = struct{}{}
		}
	}
	for _, userID := range rebateUserIDs {
		if userID > 0 {
			userIDSet[userID] = struct{}{}
		}
	}

	stats := &AppReferralStats{}
	stats.InvitedUserCount = len(userIDSet)
	err := DB.
		Model(&AppPaymentOrder{}).
		Select("COALESCE(SUM(rebate_amount), 0)").
		Where("rebate_user_id = ?", rebateUserID).
		Where("status = ?", AppPaymentStatusPaid).
		Scan(&stats.TotalRebateAmount).Error
	if err != nil {
		return nil, err
	}

	return stats, nil
}

func appPaymentOrderSelectSQL() string {
	statusSQL := "CASE " +
		"WHEN recharge_orders.source_status = '" + AppPaymentStatusPaid + "' THEN '" + AppPaymentAdminStatusSuccess + "' " +
		"WHEN recharge_orders.source_status = '" + AppPaymentStatusFailed + "' THEN '" + AppPaymentAdminStatusFailed + "' " +
		"ELSE '" + AppPaymentAdminStatusUnpaid + "' END"

	return "recharge_orders.id AS id, recharge_orders.user_id AS user_id, recharge_orders.amount AS amount, " +
		"recharge_orders.pay_amount AS pay_amount, " +
		"recharge_orders.channel AS channel, recharge_orders.out_trade_no AS out_trade_no, " +
		"recharge_orders.trade_no AS trade_no, recharge_orders.pay_type AS pay_type, recharge_orders.pay_info AS pay_info, " +
		"recharge_orders.source_status AS status, recharge_orders.notify_payload AS notify_payload, " +
		"recharge_orders.recharge_log_id AS recharge_log_id, recharge_orders.created_at AS created_at, " +
		"recharge_orders.updated_at AS updated_at, recharge_orders.paid_at AS paid_at, " +
		"recharge_orders.user_email AS user_email, recharge_orders.user_phone AS user_phone, " +
		"recharge_orders.admin_created_at AS admin_created_at, " + statusSQL + " AS admin_status"
}

func appPaymentOrderQuery(
	userID int,
	keyword string,
	channel string,
	status string,
	startTime time.Time,
	endTime time.Time,
) *gorm.DB {
	tx := DB.Table("(?) AS recharge_orders", appPaymentOrderSourceQuery()).
		Joins("LEFT JOIN app_user ON app_user.id = recharge_orders.user_id")
	if userID > 0 {
		tx = tx.Where("recharge_orders.user_id = ?", userID)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		if id := String2Int(keyword); id > 0 {
			tx = tx.Where(
				DB.Where("recharge_orders.user_id = ?", id).
					Or("app_user.username LIKE ?", likeKeyword).
					Or("app_user.email LIKE ?", likeKeyword).
					Or("app_user.phone LIKE ?", likeKeyword),
			)
		} else {
			tx = tx.Where("app_user.username LIKE ? OR app_user.email LIKE ? OR app_user.phone LIKE ?", likeKeyword, likeKeyword, likeKeyword)
		}
	}
	channel = strings.TrimSpace(channel)
	if channel != "" {
		tx = tx.Where("recharge_orders.channel = ?", channel)
	}
	status = normalizeAppPaymentAdminStatus(status)
	switch status {
	case AppPaymentAdminStatusSuccess:
		tx = tx.Where("recharge_orders.source_status = ?", AppPaymentStatusPaid)
	case AppPaymentAdminStatusUnpaid:
		tx = tx.Where("recharge_orders.source_status = ?", AppPaymentStatusPending)
	case AppPaymentAdminStatusFailed:
		tx = tx.Where("recharge_orders.source_status = ?", AppPaymentStatusFailed)
	}
	if !startTime.IsZero() {
		tx = tx.Where("recharge_orders.admin_created_at >= ?", startTime)
	}
	if !endTime.IsZero() {
		tx = tx.Where("recharge_orders.admin_created_at <= ?", endTime)
	}

	return tx
}

func appPaymentOrderSourceQuery() *gorm.DB {
	paymentOrders := DB.
		Model(&AppPaymentOrder{}).
		Select(
			"app_payment_order.id, app_payment_order.user_id, app_payment_order.amount, app_payment_order.pay_amount, " +
				"app_payment_order.channel, app_payment_order.out_trade_no, app_payment_order.trade_no, " +
				"app_payment_order.pay_type, app_payment_order.pay_info, app_payment_order.status AS source_status, " +
				"app_payment_order.notify_payload, app_payment_order.recharge_log_id, app_payment_order.created_at, " +
				"app_payment_order.updated_at, app_payment_order.paid_at, COALESCE(app_payment_order.paid_at, app_payment_order.created_at) AS admin_created_at, " +
				"app_user.email AS user_email, app_user.phone AS user_phone",
		).
		Joins("LEFT JOIN app_user ON app_user.id = app_payment_order.user_id")

	manualRecharges := DB.
		Model(&AppRechargeLog{}).
		Select(
			"app_recharge_log.id * -1 AS id, app_recharge_log.user_id, app_recharge_log.amount, app_recharge_log.amount AS pay_amount, " +
				"COALESCE(app_recharge_log.channel, '') AS channel, COALESCE(app_recharge_log.trade_no, '') AS out_trade_no, " +
				"'' AS trade_no, '' AS pay_type, '' AS pay_info, '" + AppPaymentStatusPaid + "' AS source_status, " +
				"app_recharge_log.raw_payload AS notify_payload, app_recharge_log.id AS recharge_log_id, app_recharge_log.created_at, " +
				"app_recharge_log.updated_at, app_recharge_log.created_at AS paid_at, app_recharge_log.created_at AS admin_created_at, " +
				"app_user.email AS user_email, app_user.phone AS user_phone",
		).
		Joins("LEFT JOIN app_user ON app_user.id = app_recharge_log.user_id").
		Joins("LEFT JOIN app_payment_order ON app_payment_order.recharge_log_id = app_recharge_log.id").
		Where("app_payment_order.id IS NULL")

	return DB.Raw("? UNION ALL ?", paymentOrders, manualRecharges)
}

func normalizeAppPaymentAdminStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case AppPaymentAdminStatusSuccess, AppPaymentStatusPaid:
		return AppPaymentAdminStatusSuccess
	case AppPaymentAdminStatusUnpaid, AppPaymentStatusPending:
		return AppPaymentAdminStatusUnpaid
	case AppPaymentAdminStatusFailed:
		return AppPaymentAdminStatusFailed
	default:
		return ""
	}
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
		Model(&AppWalletReservation{}).
		Where("user_id = ? AND status IN ?", userID, []string{
			AppWalletReservationStatusSettled,
			AppWalletReservationStatusFailed,
		}).
		Select("COALESCE(SUM(actual_amount), 0)").
		Scan(&total).Error

	return total, err
}

func CleanupAppWalletConsumptionLogs() error {
	return DB.
		Where("type IN ?", []string{
			AppWalletLogTypeReserve,
			AppWalletLogTypeSettle,
			AppWalletLogTypeRelease,
		}).
		Delete(&AppWalletLog{}).Error
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
					Or("app_user.username LIKE ?", likeKeyword).
					Or("app_user.email LIKE ?", likeKeyword).
					Or("app_user.phone LIKE ?", likeKeyword),
			)
		} else {
			tx = tx.Where("app_user.username LIKE ? OR app_user.email LIKE ? OR app_user.phone LIKE ?", likeKeyword, likeKeyword, likeKeyword)
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
		return appPaymentOrderQuery(0, keyword, "", "", startTime, endTime)
	}

	stats := &AppRechargeStats{}
	if err := baseQuery().
		Select(
			"COALESCE(SUM(recharge_orders.amount), 0) AS total_amount, COUNT(*) AS total_count, "+
				"COALESCE(SUM(CASE WHEN recharge_orders.source_status = ? THEN recharge_orders.amount ELSE 0 END), 0) AS paid_amount, "+
				"COALESCE(SUM(CASE WHEN recharge_orders.source_status = ? THEN 1 ELSE 0 END), 0) AS paid_count",
			AppPaymentStatusPaid,
			AppPaymentStatusPaid,
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
		Select("COALESCE(recharge_orders.channel, '') AS channel, COALESCE(SUM(recharge_orders.amount), 0) AS amount, COUNT(*) AS count").
		Where("recharge_orders.source_status = ?", AppPaymentStatusPaid).
		Group("recharge_orders.channel").
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
		Select("recharge_orders.amount, recharge_orders.admin_created_at AS created_at").
		Where("recharge_orders.source_status = ?", AppPaymentStatusPaid).
		Order("recharge_orders.admin_created_at asc").
		Scan(&paidLogs).Error; err != nil {
		return nil, err
	}

	stats.Granularity = granularity
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
	logs []*AppWalletLogWithDetail,
	total int64,
	err error,
) {
	return getAppWalletLogs(userID, page, perPage, order, nil)
}

func GetAppWalletLogsByTypes(userID, page, perPage int, order string, logTypes []string) (
	logs []*AppWalletLogWithDetail,
	total int64,
	err error,
) {
	return getAppWalletLogs(userID, page, perPage, order, logTypes)
}

func getAppWalletLogs(userID, page, perPage int, order string, logTypes []string) (
	logs []*AppWalletLogWithDetail,
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
	if err != nil || len(logs) == 0 {
		return logs, total, err
	}

	if err = attachAppWalletLogDetails(logs); err != nil {
		return nil, 0, err
	}

	return logs, total, err
}

func attachAppWalletLogDetails(logs []*AppWalletLogWithDetail) error {
	rechargeLogIDs := make([]int, 0)
	for _, log := range logs {
		if log.Type != AppWalletLogTypeRecharge || log.Remark != "DuluPay recharge" {
			continue
		}

		rechargeLogIDs = append(rechargeLogIDs, log.ID)
	}

	if len(rechargeLogIDs) == 0 {
		return nil
	}

	type walletLogPaymentRow struct {
		WalletLogID  int
		OutTradeNo   string
		TradeNo      EmptyNullString
		Amount       float64
		PayAmount    float64
		DiscountCode EmptyNullString
		Channel      string
		PayType      EmptyNullString
		PaidAt       *time.Time
	}

	rows := make([]walletLogPaymentRow, 0, len(rechargeLogIDs))
	walletLogTimeWindowSQL := "app_recharge_log.created_at BETWEEN datetime(app_wallet_log.created_at, '-5 seconds') AND datetime(app_wallet_log.created_at, '+5 seconds')"
	if DB.Dialector.Name() == "postgres" {
		walletLogTimeWindowSQL = "app_recharge_log.created_at BETWEEN app_wallet_log.created_at - INTERVAL '5 seconds' AND app_wallet_log.created_at + INTERVAL '5 seconds'"
	}

	if err := DB.
		Table("app_wallet_log").
		Select(
			"app_wallet_log.id AS wallet_log_id, app_payment_order.out_trade_no, app_payment_order.trade_no, "+
				"app_payment_order.amount, app_payment_order.pay_amount, app_payment_order.discount_code, "+
				"app_payment_order.channel, app_payment_order.pay_type, app_payment_order.paid_at",
		).
		Joins("JOIN app_recharge_log ON app_recharge_log.user_id = app_wallet_log.user_id AND app_recharge_log.amount = app_wallet_log.amount AND " + walletLogTimeWindowSQL).
		Joins("JOIN app_payment_order ON app_payment_order.recharge_log_id = app_recharge_log.id").
		Where("app_wallet_log.id IN ?", rechargeLogIDs).
		Find(&rows).Error; err != nil {
		return err
	}

	detailsByLogID := make(map[int]*AppWalletLogDetail, len(rows))
	for _, row := range rows {
		payAmount := row.PayAmount
		if payAmount <= 0 {
			payAmount = row.Amount
		}

		discountAmount := row.Amount - payAmount
		if discountAmount < 0 {
			discountAmount = 0
		}

		detailsByLogID[row.WalletLogID] = &AppWalletLogDetail{
			OutTradeNo:     row.OutTradeNo,
			TradeNo:        string(row.TradeNo),
			PayAmount:      payAmount,
			DiscountAmount: discountAmount,
			DiscountCode:   string(row.DiscountCode),
			Channel:        row.Channel,
			PayType:        string(row.PayType),
			PaidAt:         row.PaidAt,
		}
	}

	for _, log := range logs {
		log.Detail = detailsByLogID[log.ID]
	}

	return nil
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

func rebateAppUserBalanceWithTx(
	tx *gorm.DB,
	params AppUserRebateParams,
) (wallet *AppUserWallet, walletLog *AppWalletLog, err error) {
	if params.UserID == 0 {
		return nil, nil, errors.New("user id is empty")
	}

	if params.Amount <= 0 || math.IsNaN(params.Amount) || math.IsInf(params.Amount, 0) {
		return nil, nil, errors.New("rebate amount must be greater than zero")
	}

	wallet = &AppUserWallet{}
	if err := tx.
		Where("user_id = ?", params.UserID).
		Attrs(AppUserWallet{UserID: params.UserID}).
		FirstOrCreate(wallet).Error; err != nil {
		return nil, nil, err
	}

	amount := normalizeMoney(params.Amount)
	result := tx.
		Model(wallet).
		Clauses(clause.Returning{
			Columns: []clause.Column{
				{Name: "available_balance"},
				{Name: "updated_at"},
			},
		}).
		Where("id = ?", wallet.ID).
		Update("available_balance", gorm.Expr("available_balance + ?", amount))
	if err := HandleUpdateResult(result, ErrAppUserWalletNotFound); err != nil {
		return nil, nil, err
	}

	balanceAfter := wallet.AvailableBalance
	balanceBefore := balanceAfter - amount
	remark := fmt.Sprintf(
		"Recharge rebate from user #%d order %s",
		params.SourceUserID,
		strings.TrimSpace(params.OrderNo),
	)
	if code := NormalizeAppUserDiscountCode(params.DiscountCode); code != "" {
		remark += " code " + code
	}

	walletLog = &AppWalletLog{
		UserID:        params.UserID,
		Type:          AppWalletLogTypeRebate,
		Amount:        amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  balanceAfter,
		Remark:        remark,
	}
	if err := tx.Create(walletLog).Error; err != nil {
		return nil, nil, err
	}

	return wallet, walletLog, nil
}

func AdjustAppUserWalletBalance(params AppUserWalletAdjustParams) (
	wallet *AppUserWallet,
	walletLog *AppWalletLog,
	err error,
) {
	if params.UserID == 0 {
		return nil, nil, errors.New("user id is empty")
	}

	if params.Amount == 0 || math.IsNaN(params.Amount) || math.IsInf(params.Amount, 0) {
		return nil, nil, ErrAppWalletAdjustmentAmountInvalid
	}

	if _, err = GetAppUserByID(params.UserID); err != nil {
		return nil, nil, err
	}

	wallet = &AppUserWallet{}
	walletLog = &AppWalletLog{}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Where("user_id = ?", params.UserID).
			Attrs(AppUserWallet{UserID: params.UserID}).
			FirstOrCreate(wallet).Error; err != nil {
			return err
		}

		updateTx := tx.
			Model(wallet).
			Clauses(clause.Returning{
				Columns: []clause.Column{
					{Name: "available_balance"},
					{Name: "updated_at"},
				},
			}).
			Where("id = ?", wallet.ID)
		if params.Amount < 0 {
			updateTx = updateTx.Where("available_balance >= ?", -params.Amount)
		}

		result := updateTx.Update(
			"available_balance",
			gorm.Expr("available_balance + ?", params.Amount),
		)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppWalletInsufficientBalance
		}

		balanceAfter := wallet.AvailableBalance
		balanceBefore := walletAmountSub(balanceAfter, params.Amount)
		*walletLog = AppWalletLog{
			UserID:        params.UserID,
			Type:          AppWalletLogTypeAdjust,
			Amount:        params.Amount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			Remark:        params.Remark,
		}

		if err := tx.Create(walletLog).Error; err != nil {
			return err
		}

		return nil
	})

	return wallet, walletLog, err
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

		return nil
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

		return nil
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

		return nil
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
