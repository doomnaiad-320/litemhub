package model_test

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestReserveAndSettleAppUserReservation(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 10)

		wallet, reservation, err := model.ReserveAppUserBalance(model.AppUserReserveBalanceParams{
			RequestID: "req-reserve-settle",
			UserID:    user.ID,
			TokenID:   101,
			GroupID:   "g1",
			Model:     "gpt-4.1",
			Amount:    4,
			Remark:    "test reserve",
		})
		require.NoError(t, err)
		require.Equal(t, 6.0, wallet.AvailableBalance)
		require.Equal(t, 4.0, wallet.FrozenBalance)
		require.Equal(t, model.AppWalletReservationStatusHeld, reservation.Status)

		wallet, reservation, err = model.SettleAppUserReservation(reservation.ID, 2.5, "test settle")
		require.NoError(t, err)
		require.Equal(t, 7.5, wallet.AvailableBalance)
		require.Equal(t, 0.0, wallet.FrozenBalance)
		require.Equal(t, model.AppWalletReservationStatusSettled, reservation.Status)
		require.Equal(t, 2.5, reservation.ActualAmount)

		logs, total, err := model.GetAppWalletLogs(user.ID, 1, 10, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 0, total)
		require.Empty(t, logs)

		consumed, err := model.GetAppWalletHistoricalConsumed(user.ID)
		require.NoError(t, err)
		require.Equal(t, 2.5, consumed)

		rechargeLogs, total, err := model.GetAppWalletLogsByTypes(
			user.ID,
			1,
			10,
			"id-asc",
			[]string{model.AppWalletLogTypeRecharge},
		)
		require.NoError(t, err)
		require.EqualValues(t, 0, total)
		require.Empty(t, rechargeLogs)
	})
}

func TestGetAppWalletLogsByTypes(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 10)

		_, _, err := model.RechargeAppUserBalance(model.AppUserRechargeParams{
			UserID: user.ID,
			Amount: 5,
			Remark: "manual top-up",
		})
		require.NoError(t, err)

		_, reservation, err := model.ReserveAppUserBalance(model.AppUserReserveBalanceParams{
			RequestID: "req-filter-wallet-logs",
			UserID:    user.ID,
			TokenID:   101,
			GroupID:   "g1",
			Model:     "gpt-4.1",
			Amount:    2,
			Remark:    "test reserve",
		})
		require.NoError(t, err)

		_, _, err = model.SettleAppUserReservation(reservation.ID, 1.5, "test settle")
		require.NoError(t, err)

		logs, total, err := model.GetAppWalletLogs(user.ID, 1, 10, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 1, total)
		require.Len(t, logs, 1)
		require.Equal(t, model.AppWalletLogTypeRecharge, logs[0].Type)

		rechargeLogs, total, err := model.GetAppWalletLogsByTypes(
			user.ID,
			1,
			10,
			"id-asc",
			[]string{model.AppWalletLogTypeRecharge},
		)
		require.NoError(t, err)
		require.EqualValues(t, 1, total)
		require.Len(t, rechargeLogs, 1)
		require.Equal(t, model.AppWalletLogTypeRecharge, rechargeLogs[0].Type)
		require.Equal(t, 5.0, rechargeLogs[0].Amount)
	})
}

func TestAdjustAppUserWalletBalanceIncreasesAndDecreases(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 10)

		wallet, walletLog, err := model.AdjustAppUserWalletBalance(model.AppUserWalletAdjustParams{
			UserID: user.ID,
			Amount: 5,
			Remark: "manual credit",
		})
		require.NoError(t, err)
		require.Equal(t, 15.0, wallet.AvailableBalance)
		require.Equal(t, model.AppWalletLogTypeAdjust, walletLog.Type)
		require.Equal(t, 5.0, walletLog.Amount)
		require.Equal(t, 10.0, walletLog.BalanceBefore)
		require.Equal(t, 15.0, walletLog.BalanceAfter)
		require.Equal(t, "manual credit", walletLog.Remark)

		wallet, walletLog, err = model.AdjustAppUserWalletBalance(model.AppUserWalletAdjustParams{
			UserID: user.ID,
			Amount: -3,
			Remark: "manual debit",
		})
		require.NoError(t, err)
		require.Equal(t, 12.0, wallet.AvailableBalance)
		require.Equal(t, model.AppWalletLogTypeAdjust, walletLog.Type)
		require.Equal(t, -3.0, walletLog.Amount)
		require.Equal(t, 15.0, walletLog.BalanceBefore)
		require.Equal(t, 12.0, walletLog.BalanceAfter)
		require.Equal(t, "manual debit", walletLog.Remark)

		logs, total, err := model.GetAppWalletLogsByTypes(
			user.ID,
			1,
			10,
			"id-asc",
			[]string{model.AppWalletLogTypeAdjust},
		)
		require.NoError(t, err)
		require.EqualValues(t, 2, total)
		require.Len(t, logs, 2)
		require.Equal(t, 5.0, logs[0].Amount)
		require.Equal(t, -3.0, logs[1].Amount)
	})
}

func TestAdjustAppUserWalletBalanceCannotOverdraw(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 2)

		_, _, err := model.AdjustAppUserWalletBalance(model.AppUserWalletAdjustParams{
			UserID: user.ID,
			Amount: -3,
			Remark: "over debit",
		})
		require.ErrorIs(t, err, model.ErrAppWalletInsufficientBalance)

		wallet, err := model.GetAppUserWalletByUserID(user.ID)
		require.NoError(t, err)
		require.Equal(t, 2.0, wallet.AvailableBalance)

		logs, total, err := model.GetAppWalletLogsByTypes(
			user.ID,
			1,
			10,
			"id-asc",
			[]string{model.AppWalletLogTypeAdjust},
		)
		require.NoError(t, err)
		require.EqualValues(t, 0, total)
		require.Empty(t, logs)
	})
}

func TestCleanupAppWalletConsumptionLogsKeepsRechargeLogs(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		require.NoError(t, model.DB.Create(&model.AppWalletLog{
			UserID: user.ID,
			Type:   model.AppWalletLogTypeRecharge,
			Amount: 5,
		}).Error)
		require.NoError(t, model.DB.Create(&model.AppWalletLog{
			UserID: user.ID,
			Type:   model.AppWalletLogTypeReserve,
			Amount: 2,
		}).Error)
		require.NoError(t, model.DB.Create(&model.AppWalletLog{
			UserID: user.ID,
			Type:   model.AppWalletLogTypeSettle,
			Amount: 1.5,
		}).Error)
		require.NoError(t, model.DB.Create(&model.AppWalletLog{
			UserID: user.ID,
			Type:   model.AppWalletLogTypeRelease,
			Amount: 0.5,
		}).Error)

		require.NoError(t, model.CleanupAppWalletConsumptionLogs())

		logs, total, err := model.GetAppWalletLogs(user.ID, 1, 10, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 1, total)
		require.Len(t, logs, 1)
		require.Equal(t, model.AppWalletLogTypeRecharge, logs[0].Type)
	})
}

func TestGetAppRechargeStatsWithPaidDuluPayRecharge(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		paidAt := time.Date(2026, 4, 10, 13, 34, 0, 0, time.Local)

		err := model.DB.Create(&model.AppPaymentOrder{
			UserID:     user.ID,
			Amount:     50,
			Channel:    "dulupay",
			OutTradeNo: "UP-test-stats",
			Status:     model.AppPaymentStatusPaid,
			PaidAt:     &paidAt,
			CreatedAt:  paidAt,
		}).Error
		require.NoError(t, err)

		startTime := time.Date(2026, 4, 1, 0, 0, 0, 0, time.Local)
		endTime := time.Date(2026, 4, 29, 23, 59, 59, 0, time.Local)
		stats, err := model.GetAppRechargeStats("", startTime, endTime, "day")
		require.NoError(t, err)
		require.Equal(t, "day", stats.Granularity)
		require.Equal(t, 50.0, stats.PaidAmount)
		require.EqualValues(t, 1, stats.PaidCount)
		require.NotEmpty(t, stats.ByChannel)
		require.Equal(t, "dulupay", stats.ByChannel[0].Channel)
		require.Equal(t, 50.0, stats.ByChannel[0].Amount)
		require.NotEmpty(t, stats.TimeSeries)
	})
}

func TestGetAppPaymentOrdersIncludesPaidPendingAndFailedStatuses(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createdAt := time.Date(2026, 4, 29, 13, 34, 0, 0, time.Local)

		require.NoError(t, model.DB.Create(&model.AppPaymentOrder{
			UserID:     user.ID,
			Amount:     50,
			Channel:    "dulupay",
			OutTradeNo: "UP-paid",
			TradeNo:    model.EmptyNullString("dulupay-paid"),
			Status:     model.AppPaymentStatusPaid,
			CreatedAt:  createdAt,
		}).Error)
		require.NoError(t, model.DB.Create(&model.AppPaymentOrder{
			UserID:     user.ID,
			Amount:     20,
			Channel:    "dulupay",
			OutTradeNo: "UP-pending",
			Status:     model.AppPaymentStatusPending,
			CreatedAt:  createdAt.Add(time.Minute),
		}).Error)
		require.NoError(t, model.DB.Create(&model.AppPaymentOrder{
			UserID:     user.ID,
			Amount:     10,
			Channel:    "dulupay",
			OutTradeNo: "UP-failed",
			Status:     model.AppPaymentStatusFailed,
			CreatedAt:  createdAt.Add(2 * time.Minute),
		}).Error)

		orders, total, err := model.GetAppPaymentOrders(0, "", "", "", time.Time{}, time.Time{}, 1, 10, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 3, total)
		require.Len(t, orders, 3)
		require.Equal(t, model.AppPaymentAdminStatusSuccess, orders[0].AdminStatus)
		require.Equal(t, "dulupay-paid", orders[0].AdminTradeNo)
		require.Equal(t, model.AppPaymentAdminStatusUnpaid, orders[1].AdminStatus)
		require.Equal(t, "UP-pending", orders[1].AdminTradeNo)
		require.Equal(t, model.AppPaymentAdminStatusFailed, orders[2].AdminStatus)

		orders, total, err = model.GetAppPaymentOrders(0, "", "", model.AppPaymentAdminStatusUnpaid, time.Time{}, time.Time{}, 1, 10, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 1, total)
		require.Len(t, orders, 1)
		require.Equal(t, "UP-pending", orders[0].OutTradeNo)
	})
}

func TestMarkAppPaymentOrderPaidUsesPayAmountAndCreditsRechargeAmount(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		order, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
			UserID:     user.ID,
			Amount:     100,
			PayAmount:  90,
			Channel:    "dulupay",
			OutTradeNo: "UP-discounted",
		})
		require.NoError(t, err)
		require.Equal(t, 100.0, order.Amount)
		require.Equal(t, 90.0, order.PayAmount)

		order, wallet, rechargeLog, err := model.MarkAppPaymentOrderPaid(model.AppPaymentPaidParams{
			OutTradeNo:    "UP-discounted",
			TradeNo:       "dulupay-discounted",
			Amount:        90,
			NotifyPayload: `{"money":"90.00"}`,
		})
		require.NoError(t, err)
		require.Equal(t, model.AppPaymentStatusPaid, order.Status)
		require.Equal(t, 100.0, wallet.AvailableBalance)
		require.Equal(t, 100.0, rechargeLog.Amount)

		_, _, _, err = model.MarkAppPaymentOrderPaid(model.AppPaymentPaidParams{
			OutTradeNo: "UP-discounted",
			Amount:     100,
		})
		require.ErrorIs(t, err, model.ErrAppPaymentOrderAlreadyHandled)
	})
}

func TestMarkAppPaymentOrderPaidRejectsAmountDifferentFromPayAmount(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		_, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
			UserID:     user.ID,
			Amount:     100,
			PayAmount:  90,
			Channel:    "dulupay",
			OutTradeNo: "UP-discounted-mismatch",
		})
		require.NoError(t, err)

		_, _, _, err = model.MarkAppPaymentOrderPaid(model.AppPaymentPaidParams{
			OutTradeNo: "UP-discounted-mismatch",
			Amount:     100,
		})
		require.ErrorIs(t, err, model.ErrAppPaymentOrderAmountMismatch)

		wallet, err := model.GetAppUserWalletByUserID(user.ID)
		require.Error(t, err)
		require.Zero(t, wallet.ID)
	})
}

func TestMarkAppPaymentOrderFailedMarksPendingOrderAsFailed(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		order, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
			UserID:     user.ID,
			Amount:     100,
			PayAmount:  90,
			Channel:    "dulupay",
			OutTradeNo: "UP-failed-order",
		})
		require.NoError(t, err)
		require.Equal(t, model.AppPaymentStatusPending, order.Status)

		updatedOrder, err := model.MarkAppPaymentOrderFailed("UP-failed-order")
		require.NoError(t, err)
		require.Equal(t, model.AppPaymentStatusFailed, updatedOrder.Status)

		storedOrder, err := model.GetAppPaymentOrderByOutTradeNo("UP-failed-order")
		require.NoError(t, err)
		require.Equal(t, model.AppPaymentStatusFailed, storedOrder.Status)
	})
}

func TestMarkAppPaymentOrderPaidAllowsFailedOrderRecovery(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		_, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
			UserID:     user.ID,
			Amount:     100,
			PayAmount:  90,
			Channel:    "dulupay",
			OutTradeNo: "UP-failed-recovery",
		})
		require.NoError(t, err)

		_, err = model.MarkAppPaymentOrderFailed("UP-failed-recovery")
		require.NoError(t, err)

		order, wallet, rechargeLog, err := model.MarkAppPaymentOrderPaid(model.AppPaymentPaidParams{
			OutTradeNo:    "UP-failed-recovery",
			TradeNo:       "dulupay-recovered",
			Amount:        90,
			NotifyPayload: `{"money":"90.00"}`,
		})
		require.NoError(t, err)
		require.Equal(t, model.AppPaymentStatusPaid, order.Status)
		require.Equal(t, 100.0, wallet.AvailableBalance)
		require.Equal(t, 100.0, rechargeLog.Amount)
	})
}

func TestUpdateAppPaymentOrderDuluPayInfoUpdatesPendingOrder(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		order, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
			UserID:     user.ID,
			Amount:     100,
			PayAmount:  90,
			Channel:    "dulupay",
			OutTradeNo: "UP-pending-info",
		})
		require.NoError(t, err)
		require.Empty(t, string(order.TradeNo))

		updatedOrder, err := model.UpdateAppPaymentOrderDuluPayInfo(
			"UP-pending-info",
			"dulupay-trade",
			"alipay",
			"pay-info-payload",
		)
		require.NoError(t, err)
		require.Equal(t, "dulupay-trade", string(updatedOrder.TradeNo))
		require.Equal(t, "alipay", string(updatedOrder.PayType))
		require.Equal(t, "pay-info-payload", updatedOrder.PayInfo)
	})
}

func TestMarkAppPaymentOrderPaidCreditsRebateToReferrer(t *testing.T) {
	withTestAppWalletDB(t, func() {
		referrer := createTestAppUserWithEmail(t, "referrer@example.com")
		payer := createTestAppUserWithEmail(t, "payer@example.com")

		code, err := model.GetOrCreateAppUserDiscountCode(referrer.ID)
		require.NoError(t, err)
		require.NotEmpty(t, code.Code)

		order, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
			UserID:       payer.ID,
			Amount:       100,
			PayAmount:    90,
			Channel:      "dulupay",
			OutTradeNo:   "UP-rebate",
			DiscountCode: code.Code,
			RebateUserID: referrer.ID,
			RebateRatio:  0.1,
		})
		require.NoError(t, err)
		require.Equal(t, code.Code, string(order.DiscountCode))

		order, payerWallet, rechargeLog, err := model.MarkAppPaymentOrderPaid(model.AppPaymentPaidParams{
			OutTradeNo:    "UP-rebate",
			TradeNo:       "dulupay-rebate",
			Amount:        90,
			NotifyPayload: `{"money":"90.00"}`,
		})
		require.NoError(t, err)
		require.Equal(t, 100.0, payerWallet.AvailableBalance)
		require.Equal(t, 100.0, rechargeLog.Amount)
		require.Equal(t, 9.0, order.RebateAmount)
		require.NotZero(t, order.RebateLogID)

		referrerWallet, err := model.GetAppUserWalletByUserID(referrer.ID)
		require.NoError(t, err)
		require.Equal(t, 9.0, referrerWallet.AvailableBalance)

		referrerLogs, total, err := model.GetAppWalletLogsByTypes(
			referrer.ID,
			1,
			10,
			"id-asc",
			[]string{model.AppWalletLogTypeRebate},
		)
		require.NoError(t, err)
		require.EqualValues(t, 1, total)
		require.Len(t, referrerLogs, 1)
		require.Equal(t, model.AppWalletLogTypeRebate, referrerLogs[0].Type)
		require.Equal(t, 9.0, referrerLogs[0].Amount)

		payerLogs, total, err := model.GetAppWalletLogsByTypes(
			payer.ID,
			1,
			10,
			"id-asc",
			[]string{model.AppWalletLogTypeRebate},
		)
		require.NoError(t, err)
		require.EqualValues(t, 0, total)
		require.Empty(t, payerLogs)
	})
}

func TestResolveAppRechargeRebateFallsBackToDirectReferral(t *testing.T) {
	withTestAppWalletDB(t, func() {
		referrer := createTestAppUserWithEmail(t, "fallback-referrer@example.com")
		payer := createTestAppUserWithEmail(t, "fallback-payer@example.com")
		code, err := model.GetOrCreateAppUserDiscountCode(referrer.ID)
		require.NoError(t, err)
		require.NoError(t, model.DB.Create(&model.AppUserReferral{
			InviterUserID: referrer.ID,
			InvitedUserID: payer.ID,
			DiscountCode:  model.EmptyNullString(code.Code),
		}).Error)

		resolution, err := model.ResolveAppRechargeRebate(payer.ID, "", 0.1)
		require.NoError(t, err)
		require.Equal(t, code.Code, resolution.DiscountCode)
		require.Equal(t, referrer.ID, resolution.RebateUserID)
		require.Equal(t, 0.1, resolution.RebateRatio)
	})
}

func TestResolveAppRechargeRebateExplicitDiscountCodeOverridesDirectReferral(t *testing.T) {
	withTestAppWalletDB(t, func() {
		registeredReferrer := createTestAppUserWithEmail(t, "registered-referrer@example.com")
		explicitReferrer := createTestAppUserWithEmail(t, "explicit-referrer@example.com")
		payer := createTestAppUserWithEmail(t, "explicit-payer@example.com")
		registeredCode, err := model.GetOrCreateAppUserDiscountCode(registeredReferrer.ID)
		require.NoError(t, err)
		explicitCode, err := model.GetOrCreateAppUserDiscountCode(explicitReferrer.ID)
		require.NoError(t, err)
		require.NoError(t, model.DB.Create(&model.AppUserReferral{
			InviterUserID: registeredReferrer.ID,
			InvitedUserID: payer.ID,
			DiscountCode:  model.EmptyNullString(registeredCode.Code),
		}).Error)

		resolution, err := model.ResolveAppRechargeRebate(payer.ID, explicitCode.Code, 0.1)
		require.NoError(t, err)
		require.Equal(t, explicitCode.Code, resolution.DiscountCode)
		require.Equal(t, explicitReferrer.ID, resolution.RebateUserID)
		require.Equal(t, 0.1, resolution.RebateRatio)
	})
}

func TestGetAppReferralRecordsIncludesExplicitDiscountCodeRebates(t *testing.T) {
	withTestAppWalletDB(t, func() {
		referrer := createTestAppUserWithEmail(t, "explicit-record-referrer@example.com")
		payer := createTestAppUserWithEmail(t, "explicit-record-payer@example.com")
		code, err := model.GetOrCreateAppUserDiscountCode(referrer.ID)
		require.NoError(t, err)
		paidAt := time.Date(2026, 5, 19, 12, 0, 0, 0, time.Local)
		require.NoError(t, model.DB.Create(&model.AppPaymentOrder{
			UserID:       payer.ID,
			Amount:       100,
			PayAmount:    90,
			Channel:      "dulupay",
			OutTradeNo:   "UP-explicit-record",
			Status:       model.AppPaymentStatusPaid,
			DiscountCode: model.EmptyNullString(code.Code),
			RebateUserID: referrer.ID,
			RebateRatio:  0.1,
			RebateAmount: 9,
			CreatedAt:    paidAt,
			PaidAt:       &paidAt,
		}).Error)

		records, total, err := model.GetAppReferralRecordsByRebateUserID(referrer.ID, 1, 10, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 1, total)
		require.Len(t, records, 1)
		require.Equal(t, payer.ID, records[0].InvitedUserID)
		require.Equal(t, code.Code, string(records[0].DiscountCode))
		require.Equal(t, 1, records[0].OrderCount)
		require.Equal(t, 9.0, records[0].RebateAmount)
		require.Equal(t, model.AppReferralStatusRecharged, records[0].Status)
	})
}

func TestGetOrCreateAppUserDiscountCodeGeneratesShortAlphanumericCode(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		code, err := model.GetOrCreateAppUserDiscountCode(user.ID)
		require.NoError(t, err)
		require.Len(t, code.Code, 6)
		require.True(t, model.IsAppUserDiscountCodeValid(code.Code))

		lowercaseCode, err := model.GetAppUserDiscountCodeByCode(strings.ToLower(code.Code))
		require.NoError(t, err)
		require.Equal(t, code.ID, lowercaseCode.ID)
	})
}

func TestReleaseAppUserReservation(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 8)

		_, reservation, err := model.ReserveAppUserBalance(model.AppUserReserveBalanceParams{
			RequestID: "req-release",
			UserID:    user.ID,
			TokenID:   102,
			GroupID:   "g1",
			Model:     "gpt-4.1",
			Amount:    3,
			Remark:    "test release",
		})
		require.NoError(t, err)

		wallet, reservation, err := model.ReleaseAppUserReservation(reservation.ID, "test release")
		require.NoError(t, err)
		require.Equal(t, 8.0, wallet.AvailableBalance)
		require.Equal(t, 0.0, wallet.FrozenBalance)
		require.Equal(t, model.AppWalletReservationStatusReleased, reservation.Status)
	})
}

func TestReserveAppUserBalanceInsufficient(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 1)

		_, _, err := model.ReserveAppUserBalance(model.AppUserReserveBalanceParams{
			RequestID: "req-insufficient",
			UserID:    user.ID,
			TokenID:   103,
			GroupID:   "g1",
			Model:     "gpt-4.1",
			Amount:    2,
		})
		require.ErrorIs(t, err, model.ErrAppWalletInsufficientBalance)
	})
}

func TestUpdateAppUserStatus(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		updatedUser, err := model.UpdateAppUserStatus(user.ID, model.AppUserStatusDisabled)
		require.NoError(t, err)
		require.Equal(t, model.AppUserStatusDisabled, updatedUser.Status)

		persistedUser, err := model.GetAppUserByID(user.ID)
		require.NoError(t, err)
		require.Equal(t, model.AppUserStatusDisabled, persistedUser.Status)

		unchangedUser, err := model.UpdateAppUserStatus(user.ID, model.AppUserStatusDisabled)
		require.NoError(t, err)
		require.Equal(t, model.AppUserStatusDisabled, unchangedUser.Status)
	})
}

func TestUpdateAppUserStatusInvalid(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		_, err := model.UpdateAppUserStatus(user.ID, 999)
		require.ErrorIs(t, err, model.ErrAppUserStatusInvalid)
	})
}

func TestDeleteAppUserMeansDisableByStatus(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		disabledUser, err := model.UpdateAppUserStatus(user.ID, model.AppUserStatusDisabled)
		require.NoError(t, err)
		require.Equal(t, model.AppUserStatusDisabled, disabledUser.Status)

		persistedUser, err := model.GetAppUserByID(user.ID)
		require.NoError(t, err)
		require.Equal(t, model.AppUserStatusDisabled, persistedUser.Status)
	})
}

func TestUpdateAppUserAccount(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		updatedUser, err := model.UpdateAppUserAccount(user.ID, "new-user", "New@Example.com", " 13800138000 ")
		require.NoError(t, err)
		require.Equal(t, "new-user", string(updatedUser.Username))
		require.Equal(t, "new@example.com", string(updatedUser.Email))
		require.Equal(t, "13800138000", string(updatedUser.Phone))
	})
}

func TestUpdateAppUserAccountInvalid(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		_, err := model.UpdateAppUserAccount(user.ID, "", "", "")
		require.ErrorIs(t, err, model.ErrAppUserAccountInvalid)
	})
}

func TestUpdateAppUserPasswordHash(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		updatedUser, err := model.UpdateAppUserPasswordHash(user.ID, "new-hash")
		require.NoError(t, err)
		require.Equal(t, "new-hash", updatedUser.PasswordHash)
	})
}

func TestAdminResetPasswordHashCanBeUsedForLogin(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		passwordHash, err := bcrypt.GenerateFromPassword([]byte("Demo123456"), bcrypt.DefaultCost)
		require.NoError(t, err)

		updatedUser, err := model.UpdateAppUserPasswordHash(user.ID, string(passwordHash))
		require.NoError(t, err)
		require.NoError(t, bcrypt.CompareHashAndPassword([]byte(updatedUser.PasswordHash), []byte("Demo123456")))
	})
}

func TestFailAppUserReservation(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 5)

		_, reservation, err := model.ReserveAppUserBalance(model.AppUserReserveBalanceParams{
			RequestID: "req-fail-settle",
			UserID:    user.ID,
			TokenID:   301,
			GroupID:   "g1",
			Model:     "gpt-4.1",
			Amount:    2,
			Remark:    "test fail mark",
		})
		require.NoError(t, err)

		failedReservation, err := model.FailAppUserReservation(
			reservation.ID,
			3.5,
			"wallet settlement failed: wallet balance not enough",
		)
		require.NoError(t, err)
		require.Equal(t, model.AppWalletReservationStatusFailed, failedReservation.Status)
		require.Equal(t, 3.5, failedReservation.ActualAmount)
		require.Contains(t, failedReservation.Reason, "wallet settlement failed")

		wallet, err := model.GetAppUserWalletByUserID(user.ID)
		require.NoError(t, err)
		require.Equal(t, 3.0, wallet.AvailableBalance)
		require.Equal(t, 2.0, wallet.FrozenBalance)

		consumed, err := model.GetAppWalletHistoricalConsumed(user.ID)
		require.NoError(t, err)
		require.Equal(t, 3.5, consumed)
	})
}

func TestReserveAppUserBalanceConcurrentDoesNotOverdraw(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)
		createTestAppWallet(t, user.ID, 3)

		const (
			parallelRequests = 12
			reserveAmount    = 1.0
		)

		errs := make(chan error, parallelRequests)
		var wg sync.WaitGroup

		for i := range parallelRequests {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()

				_, _, err := model.ReserveAppUserBalance(model.AppUserReserveBalanceParams{
					RequestID: fmt.Sprintf("req-concurrent-%02d", index),
					UserID:    user.ID,
					TokenID:   200 + index,
					GroupID:   "g1",
					Model:     "gpt-4.1",
					Amount:    reserveAmount,
				})
				errs <- err
			}(i)
		}

		wg.Wait()
		close(errs)

		successCount := 0
		insufficientCount := 0

		for err := range errs {
			switch {
			case err == nil:
				successCount++
			case errors.Is(err, model.ErrAppWalletInsufficientBalance):
				insufficientCount++
			default:
				require.NoError(t, err)
			}
		}

		require.Equal(t, 3, successCount)
		require.Equal(t, parallelRequests-3, insufficientCount)

		wallet, err := model.GetAppUserWalletByUserID(user.ID)
		require.NoError(t, err)
		require.Equal(t, 0.0, wallet.AvailableBalance)
		require.Equal(t, 3.0, wallet.FrozenBalance)

		var heldReservationCount int64
		require.NoError(t, model.DB.Model(&model.AppWalletReservation{}).
			Where("user_id = ? AND status = ?", user.ID, model.AppWalletReservationStatusHeld).
			Count(&heldReservationCount).Error)
		require.EqualValues(t, 3, heldReservationCount)

		logs, total, err := model.GetAppWalletLogs(user.ID, 1, 20, "id-asc")
		require.NoError(t, err)
		require.EqualValues(t, 0, total)
		require.Empty(t, logs)
	})
}

func withTestAppWalletDB(t *testing.T, fn func()) {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LogDB
	oldUsingSQLite := common.UsingSQLite

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "app_wallet_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.AppUser{},
		&model.AppUserDiscountCode{},
		&model.AppUserReferral{},
		&model.AppUserWallet{},
		&model.AppRechargeLog{},
		&model.AppPaymentOrder{},
		&model.AppWalletReservation{},
		&model.AppWalletLog{},
	))

	model.DB = db
	model.LogDB = db
	common.UsingSQLite = true

	t.Cleanup(func() {
		model.DB = oldDB
		model.LogDB = oldLogDB
		common.UsingSQLite = oldUsingSQLite

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	fn()
}

func createTestAppUser(t *testing.T) *model.AppUser {
	t.Helper()

	return createTestAppUserWithEmail(t, "wallet@example.com")
}

func createTestAppUserWithEmail(t *testing.T, email string) *model.AppUser {
	t.Helper()

	user := &model.AppUser{
		Email:        model.EmptyNullString(email),
		PasswordHash: "hashed-password",
		Status:       model.AppUserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)

	return user
}

func createTestAppWallet(t *testing.T, userID int, availableBalance float64) *model.AppUserWallet {
	t.Helper()

	wallet := &model.AppUserWallet{
		UserID:           userID,
		AvailableBalance: availableBalance,
	}
	require.NoError(t, model.DB.Create(wallet).Error)

	return wallet
}
