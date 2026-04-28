package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/labring/aiproxy/core/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	AppPaymentStatusPending = "pending"
	AppPaymentStatusPaid    = "paid"
)

var (
	ErrAppPaymentOrderNotFound       = errors.New("app payment order not found")
	ErrAppPaymentOrderAlreadyHandled = errors.New("app payment order already handled")
	ErrAppPaymentOrderAmountMismatch = errors.New("app payment order amount mismatch")
)

type AppPaymentCreateParams struct {
	UserID     int
	Amount     float64
	Channel    string
	OutTradeNo string
	TradeNo    string
	PayType    string
	PayInfo    string
}

type AppPaymentPaidParams struct {
	OutTradeNo    string
	TradeNo       string
	Amount        float64
	NotifyPayload string
}

func NewAppPaymentOutTradeNo(userID int) string {
	return fmt.Sprintf("UP%d%s", userID, common.ShortUUID()[:24])
}

func CreateAppPaymentOrder(params AppPaymentCreateParams) (*AppPaymentOrder, error) {
	if params.UserID == 0 {
		return nil, errors.New("user id is empty")
	}

	if params.Amount <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	channel := strings.TrimSpace(params.Channel)
	if channel == "" {
		channel = "dulupay"
	}

	outTradeNo := strings.TrimSpace(params.OutTradeNo)
	if outTradeNo == "" {
		outTradeNo = NewAppPaymentOutTradeNo(params.UserID)
	}

	order := &AppPaymentOrder{
		UserID:     params.UserID,
		Amount:     normalizeMoney(params.Amount),
		Channel:    channel,
		OutTradeNo: outTradeNo,
		TradeNo:    EmptyNullString(strings.TrimSpace(params.TradeNo)),
		PayType:    EmptyNullString(strings.TrimSpace(params.PayType)),
		PayInfo:    strings.TrimSpace(params.PayInfo),
		Status:     AppPaymentStatusPending,
	}

	if err := DB.Create(order).Error; err != nil {
		return nil, err
	}

	return order, nil
}

func GetAppPaymentOrderByOutTradeNo(outTradeNo string) (*AppPaymentOrder, error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return nil, errors.New("out trade no is empty")
	}

	var order AppPaymentOrder
	err := DB.Where("out_trade_no = ?", outTradeNo).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAppPaymentOrderNotFound
	}

	return &order, err
}

func MarkAppPaymentOrderPaid(params AppPaymentPaidParams) (
	order *AppPaymentOrder,
	wallet *AppUserWallet,
	rechargeLog *AppRechargeLog,
	err error,
) {
	params.OutTradeNo = strings.TrimSpace(params.OutTradeNo)
	params.TradeNo = strings.TrimSpace(params.TradeNo)
	if params.OutTradeNo == "" {
		return nil, nil, nil, errors.New("out trade no is empty")
	}

	if params.Amount <= 0 {
		return nil, nil, nil, errors.New("amount must be greater than zero")
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		order = &AppPaymentOrder{}
		if err := tx.Where("out_trade_no = ?", params.OutTradeNo).First(order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAppPaymentOrderNotFound
			}

			return err
		}

		if order.Status == AppPaymentStatusPaid {
			return ErrAppPaymentOrderAlreadyHandled
		}

		if !moneyEqual(order.Amount, params.Amount) {
			return ErrAppPaymentOrderAmountMismatch
		}

		now := time.Now()
		result := tx.Model(order).
			Where("id = ? AND status = ?", order.ID, AppPaymentStatusPending).
			Updates(map[string]any{
				"status":         AppPaymentStatusPaid,
				"trade_no":       EmptyNullString(params.TradeNo),
				"notify_payload": params.NotifyPayload,
				"paid_at":        &now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppPaymentOrderAlreadyHandled
		}

		var rechargeErr error
		wallet, rechargeLog, rechargeErr = rechargeAppUserBalanceWithTx(tx, AppUserRechargeParams{
			UserID:     order.UserID,
			Amount:     order.Amount,
			Channel:    order.Channel,
			TradeNo:    order.OutTradeNo,
			RawPayload: params.NotifyPayload,
			Remark:     "DuluPay recharge",
		})
		if rechargeErr != nil {
			return rechargeErr
		}

		return tx.Model(order).Update("recharge_log_id", rechargeLog.ID).Error
	})

	return order, wallet, rechargeLog, err
}

func normalizeMoney(amount float64) float64 {
	return decimal.NewFromFloat(amount).Round(2).InexactFloat64()
}

func moneyEqual(a, b float64) bool {
	return decimal.NewFromFloat(a).
		Round(2).
		Equal(decimal.NewFromFloat(b).Round(2))
}
