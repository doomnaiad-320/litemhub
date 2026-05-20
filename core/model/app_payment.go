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
	AppPaymentStatusFailed  = "failed"
)

const (
	AppPaymentAdminStatusSuccess = "success"
	AppPaymentAdminStatusUnpaid  = "unpaid"
	AppPaymentAdminStatusFailed  = "failed"
)

var (
	ErrAppPaymentOrderNotFound       = errors.New("app payment order not found")
	ErrAppPaymentOrderAlreadyHandled = errors.New("app payment order already handled")
	ErrAppPaymentOrderAmountMismatch = errors.New("app payment order amount mismatch")
	ErrAppRechargeSelfDiscountCode   = errors.New("cannot use your own discount code")
)

type AppPaymentCreateParams struct {
	UserID       int
	Amount       float64
	PayAmount    float64
	Channel      string
	OutTradeNo   string
	TradeNo      string
	PayType      string
	PayInfo      string
	DiscountCode string
	RebateUserID int
	RebateRatio  float64
}

type AppRechargeRebateResolution struct {
	DiscountCode string
	RebateUserID int
	RebateRatio  float64
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

func ResolveAppRechargeRebate(
	userID int,
	discountCode string,
	rebateRatio float64,
) (*AppRechargeRebateResolution, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	normalizedCode := NormalizeAppUserDiscountCode(discountCode)
	if normalizedCode != "" {
		code, err := GetAppUserDiscountCodeByCode(normalizedCode)
		if err != nil {
			return nil, err
		}

		if code.UserID == userID {
			return nil, ErrAppRechargeSelfDiscountCode
		}

		return &AppRechargeRebateResolution{
			DiscountCode: normalizedCode,
			RebateUserID: code.UserID,
			RebateRatio:  rebateRatio,
		}, nil
	}

	referral, err := GetAppUserReferralByInvitedUserID(userID)
	if err != nil {
		if errors.Is(err, ErrAppUserReferralNotFound) {
			return &AppRechargeRebateResolution{}, nil
		}

		return nil, err
	}

	if referral.InviterUserID == 0 || referral.InviterUserID == userID {
		return &AppRechargeRebateResolution{}, nil
	}

	return &AppRechargeRebateResolution{
		DiscountCode: NormalizeAppUserDiscountCode(string(referral.DiscountCode)),
		RebateUserID: referral.InviterUserID,
		RebateRatio:  rebateRatio,
	}, nil
}

func CreateAppPaymentOrder(params AppPaymentCreateParams) (*AppPaymentOrder, error) {
	if params.UserID == 0 {
		return nil, errors.New("user id is empty")
	}

	if params.Amount <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	payAmount := params.PayAmount
	if payAmount <= 0 {
		payAmount = params.Amount
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
		UserID:       params.UserID,
		Amount:       normalizeMoney(params.Amount),
		PayAmount:    normalizeMoney(payAmount),
		Channel:      channel,
		OutTradeNo:   outTradeNo,
		TradeNo:      EmptyNullString(strings.TrimSpace(params.TradeNo)),
		PayType:      EmptyNullString(strings.TrimSpace(params.PayType)),
		PayInfo:      strings.TrimSpace(params.PayInfo),
		Status:       AppPaymentStatusPending,
		DiscountCode: EmptyNullString(NormalizeAppUserDiscountCode(params.DiscountCode)),
		RebateUserID: params.RebateUserID,
		RebateRatio:  params.RebateRatio,
	}

	if err := DB.Create(order).Error; err != nil {
		return nil, err
	}

	return order, nil
}

func UpdateAppPaymentOrderDuluPayInfo(outTradeNo, tradeNo, payType, payInfo string) (*AppPaymentOrder, error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	tradeNo = strings.TrimSpace(tradeNo)
	payType = strings.TrimSpace(payType)
	payInfo = strings.TrimSpace(payInfo)
	if outTradeNo == "" {
		return nil, errors.New("out trade no is empty")
	}

	order := &AppPaymentOrder{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("out_trade_no = ?", outTradeNo).First(order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAppPaymentOrderNotFound
			}

			return err
		}

		if order.Status == AppPaymentStatusPaid {
			return ErrAppPaymentOrderAlreadyHandled
		}

		updates := map[string]any{}
		if tradeNo != "" {
			updates["trade_no"] = EmptyNullString(tradeNo)
		}
		if payType != "" {
			updates["pay_type"] = EmptyNullString(payType)
		}
		if payInfo != "" {
			updates["pay_info"] = payInfo
		}

		if len(updates) == 0 {
			return nil
		}

		result := tx.Model(order).Where("id = ?", order.ID).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppPaymentOrderAlreadyHandled
		}

		return tx.Where("id = ?", order.ID).First(order).Error
	})
	if err != nil {
		return nil, err
	}

	return order, nil
}

func MarkAppPaymentOrderFailed(outTradeNo string) (*AppPaymentOrder, error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return nil, errors.New("out trade no is empty")
	}

	order := &AppPaymentOrder{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("out_trade_no = ?", outTradeNo).First(order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAppPaymentOrderNotFound
			}

			return err
		}

		if order.Status == AppPaymentStatusPaid {
			return ErrAppPaymentOrderAlreadyHandled
		}

		result := tx.Model(order).
			Where("id = ?", order.ID).
			Update("status", AppPaymentStatusFailed)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAppPaymentOrderAlreadyHandled
		}

		return tx.Where("id = ?", order.ID).First(order).Error
	})
	if err != nil {
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

		if !moneyEqual(order.ExpectedPayAmount(), params.Amount) {
			return ErrAppPaymentOrderAmountMismatch
		}

		now := time.Now()
		result := tx.Model(order).
			Where("id = ? AND status IN ?", order.ID, []string{AppPaymentStatusPending, AppPaymentStatusFailed}).
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
		order.Status = AppPaymentStatusPaid
		order.TradeNo = EmptyNullString(params.TradeNo)
		order.NotifyPayload = params.NotifyPayload
		order.PaidAt = &now

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

		updates := map[string]any{
			"recharge_log_id": rechargeLog.ID,
		}

		if order.RebateUserID > 0 && order.RebateRatio > 0 && order.RebateUserID != order.UserID {
			rebateAmount := calculateRebateAmount(order.ExpectedPayAmount(), order.RebateRatio)
			if rebateAmount > 0 {
				_, rebateLog, err := rebateAppUserBalanceWithTx(tx, AppUserRebateParams{
					UserID:       order.RebateUserID,
					Amount:       rebateAmount,
					SourceUserID: order.UserID,
					OrderNo:      order.OutTradeNo,
					DiscountCode: string(order.DiscountCode),
				})
				if err != nil {
					return err
				}

				order.RebateAmount = rebateAmount
				order.RebateLogID = rebateLog.ID
				updates["rebate_amount"] = rebateAmount
				updates["rebate_log_id"] = rebateLog.ID
			}
		}

		return tx.Model(order).Updates(updates).Error
	})

	return order, wallet, rechargeLog, err
}

func normalizeMoney(amount float64) float64 {
	return decimal.NewFromFloat(amount).Round(2).InexactFloat64()
}

func calculateRebateAmount(payAmount float64, rebateRatio float64) float64 {
	if payAmount <= 0 || rebateRatio <= 0 {
		return 0
	}

	return normalizeMoney(payAmount * rebateRatio)
}

func (o *AppPaymentOrder) ExpectedPayAmount() float64 {
	if o.PayAmount > 0 {
		return o.PayAmount
	}

	return o.Amount
}

func moneyEqual(a, b float64) bool {
	return decimal.NewFromFloat(a).
		Round(2).
		Equal(decimal.NewFromFloat(b).Round(2))
}
