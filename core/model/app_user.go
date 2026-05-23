package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	AppUserStatusEnabled  = 1
	AppUserStatusDisabled = 2
)

func IsAppUserStatusValid(status int) bool {
	switch status {
	case AppUserStatusEnabled, AppUserStatusDisabled:
		return true
	default:
		return false
	}
}

const (
	AppUserGroupStatusEnabled  = 1
	AppUserGroupStatusDisabled = 2
)

const (
	AppRechargeStatusPending = "pending"
	AppRechargeStatusPaid    = "paid"
	AppRechargeStatusFailed  = "failed"
)

const (
	AppWalletReservationStatusHeld     = "held"
	AppWalletReservationStatusSettled  = "settled"
	AppWalletReservationStatusReleased = "released"
	AppWalletReservationStatusFailed   = "failed"
)

const (
	AppWalletLogTypeRecharge = "recharge"
	AppWalletLogTypeReserve  = "reserve"
	AppWalletLogTypeSettle   = "settle"
	AppWalletLogTypeRelease  = "release"
	AppWalletLogTypeAdjust   = "adjust"
	AppWalletLogTypeRebate   = "rebate"
)

type AppUser struct {
	ID           int             `json:"id"            gorm:"primaryKey"`
	Username     EmptyNullString `json:"username"      gorm:"size:64;uniqueIndex"`
	Email        EmptyNullString `json:"email"         gorm:"size:255;uniqueIndex"`
	Phone        EmptyNullString `json:"phone"         gorm:"size:32;uniqueIndex"`
	PasswordHash string          `json:"-"             gorm:"size:255;not null"`
	Status       int             `json:"status"        gorm:"default:1;index"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

func (*AppUser) TableName() string {
	return "app_user"
}

func (u *AppUser) BeforeSave(_ *gorm.DB) error {
	if u.Username == "" && u.Email == "" && u.Phone == "" {
		return errors.New("username, email or phone is required")
	}

	if u.PasswordHash == "" {
		return errors.New("password hash is required")
	}

	return nil
}

type AppUserDiscountCode struct {
	ID        int       `json:"id"         gorm:"primaryKey"`
	UserID    int       `json:"user_id"    gorm:"uniqueIndex;not null"`
	Code      string    `json:"code"       gorm:"size:6;uniqueIndex;not null"`
	Status    int       `json:"status"     gorm:"default:1;index"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (*AppUserDiscountCode) TableName() string {
	return "app_user_discount_code"
}

func (c *AppUserDiscountCode) BeforeSave(_ *gorm.DB) error {
	if c.UserID == 0 {
		return errors.New("user id is required")
	}

	if c.Code == "" {
		return errors.New("discount code is required")
	}

	return nil
}

type AppUserReferral struct {
	ID            int             `json:"id"                gorm:"primaryKey"`
	InviterUserID int             `json:"inviter_user_id"   gorm:"index;not null"`
	InvitedUserID int             `json:"invited_user_id"   gorm:"uniqueIndex;not null"`
	DiscountCode  EmptyNullString `json:"discount_code"     gorm:"size:32;index"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

func (*AppUserReferral) TableName() string {
	return "app_user_referral"
}

func (r *AppUserReferral) BeforeSave(_ *gorm.DB) error {
	if r.InviterUserID == 0 {
		return errors.New("inviter user id is required")
	}

	if r.InvitedUserID == 0 {
		return errors.New("invited user id is required")
	}

	if r.InviterUserID == r.InvitedUserID {
		return errors.New("inviter user id cannot equal invited user id")
	}

	return nil
}

type AppUserWallet struct {
	ID               int       `json:"id"                gorm:"primaryKey"`
	UserID           int       `json:"user_id"           gorm:"uniqueIndex;not null"`
	AvailableBalance float64   `json:"available_balance" gorm:"default:0"`
	FrozenBalance    float64   `json:"frozen_balance"    gorm:"default:0"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (*AppUserWallet) TableName() string {
	return "app_user_wallet"
}

func (w *AppUserWallet) BeforeSave(_ *gorm.DB) error {
	if w.UserID == 0 {
		return errors.New("user id is required")
	}

	if w.AvailableBalance < 0 || w.FrozenBalance < 0 {
		return errors.New("wallet balance cannot be negative")
	}

	return nil
}

type AppRechargeLog struct {
	ID         int             `json:"id"          gorm:"primaryKey"`
	UserID     int             `json:"user_id"     gorm:"index;not null"`
	Amount     float64         `json:"amount"`
	Channel    EmptyNullString `json:"channel"     gorm:"size:32;index"`
	TradeNo    EmptyNullString `json:"trade_no"    gorm:"size:128;uniqueIndex"`
	Status     string          `json:"status"      gorm:"size:32;index;not null"`
	RawPayload string          `json:"raw_payload" gorm:"type:text"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

func (*AppRechargeLog) TableName() string {
	return "app_recharge_log"
}

func (r *AppRechargeLog) BeforeSave(_ *gorm.DB) error {
	if r.UserID == 0 {
		return errors.New("user id is required")
	}

	if r.Amount <= 0 {
		return errors.New("amount must be greater than zero")
	}

	if r.Status == "" {
		return errors.New("status is required")
	}

	return nil
}

type AppPaymentOrder struct {
	ID            int             `json:"id"               gorm:"primaryKey"`
	UserID        int             `json:"user_id"          gorm:"index;not null"`
	Amount        float64         `json:"amount"`
	PayAmount     float64         `json:"pay_amount"`
	Channel       string          `json:"channel"          gorm:"size:32;index;not null"`
	OutTradeNo    string          `json:"out_trade_no"     gorm:"size:128;uniqueIndex;not null"`
	TradeNo       EmptyNullString `json:"trade_no"         gorm:"size:128;index"`
	PayType       EmptyNullString `json:"pay_type"         gorm:"size:32"`
	PayInfo       string          `json:"pay_info"         gorm:"type:text"`
	Status        string          `json:"status"           gorm:"size:32;index;not null"`
	NotifyPayload string          `json:"notify_payload"   gorm:"type:text"`
	RechargeLogID int             `json:"recharge_log_id"  gorm:"index"`
	DiscountCode  EmptyNullString `json:"discount_code"    gorm:"size:32;index"`
	RebateUserID  int             `json:"rebate_user_id"   gorm:"index"`
	RebateRatio   float64         `json:"rebate_ratio"`
	RebateAmount  float64         `json:"rebate_amount"`
	RebateLogID   int             `json:"rebate_log_id"    gorm:"index"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	PaidAt        *time.Time      `json:"paid_at,omitempty"`
}

func (*AppPaymentOrder) TableName() string {
	return "app_payment_order"
}

func (o *AppPaymentOrder) BeforeSave(_ *gorm.DB) error {
	if o.UserID == 0 {
		return errors.New("user id is required")
	}

	if o.Amount <= 0 {
		return errors.New("amount must be greater than zero")
	}

	if o.Channel == "" {
		return errors.New("channel is required")
	}

	if o.OutTradeNo == "" {
		return errors.New("out trade no is required")
	}

	if o.Status == "" {
		return errors.New("status is required")
	}

	return nil
}

type AppWalletReservation struct {
	ID             int             `json:"id"              gorm:"primaryKey"`
	RequestID      EmptyNullString `json:"request_id"      gorm:"size:64;uniqueIndex"`
	UserID         int             `json:"user_id"         gorm:"index;not null"`
	TokenID        int             `json:"token_id"        gorm:"index"`
	GroupID        string          `json:"group_id"        gorm:"size:64;index"`
	Model          string          `json:"model"           gorm:"size:255;index"`
	ReservedAmount float64         `json:"reserved_amount" gorm:"default:0"`
	ActualAmount   float64         `json:"actual_amount"   gorm:"default:0"`
	Status         string          `json:"status"          gorm:"size:32;index;not null"`
	Reason         string          `json:"reason"          gorm:"type:text"`
	ExpiresAt      time.Time       `json:"expires_at"      gorm:"index"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

func (*AppWalletReservation) TableName() string {
	return "app_wallet_reservation"
}

func (r *AppWalletReservation) BeforeSave(_ *gorm.DB) error {
	if r.UserID == 0 {
		return errors.New("user id is required")
	}

	if r.Status == "" {
		return errors.New("status is required")
	}

	return nil
}

type AppWalletLog struct {
	ID            int             `json:"id"             gorm:"primaryKey"`
	UserID        int             `json:"user_id"        gorm:"index;not null"`
	Type          string          `json:"type"           gorm:"size:32;index;not null"`
	Amount        float64         `json:"amount"`
	BalanceBefore float64         `json:"balance_before"`
	BalanceAfter  float64         `json:"balance_after"`
	RequestID     EmptyNullString `json:"request_id"     gorm:"size:64;index"`
	ReservationID int             `json:"reservation_id" gorm:"index"`
	RechargeLogID int             `json:"recharge_log_id" gorm:"index"`
	Remark        string          `json:"remark"         gorm:"type:text"`
	CreatedAt     time.Time       `json:"created_at"`
}

func (*AppWalletLog) TableName() string {
	return "app_wallet_log"
}

func (l *AppWalletLog) BeforeSave(_ *gorm.DB) error {
	if l.UserID == 0 {
		return errors.New("user id is required")
	}

	if l.Type == "" {
		return errors.New("type is required")
	}

	return nil
}

type AppUserGroup struct {
	ID                      int       `json:"id"                        gorm:"primaryKey"`
	UserID                  int       `json:"user_id"                   gorm:"not null;uniqueIndex:idx_app_user_group"`
	GroupID                 string    `json:"group_id"                  gorm:"size:64;not null;index;uniqueIndex:idx_app_user_group"`
	Status                  int       `json:"status"                    gorm:"default:1;index"`
	PriceMultiplierOverride *float64  `json:"price_multiplier_override,omitempty" gorm:"index"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

func (*AppUserGroup) TableName() string {
	return "app_user_group"
}

func (g *AppUserGroup) BeforeSave(_ *gorm.DB) error {
	if g.UserID == 0 {
		return errors.New("user id is required")
	}

	if g.GroupID == "" {
		return errors.New("group id is required")
	}

	return nil
}
