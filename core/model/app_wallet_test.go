package model_test

import (
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

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
		require.EqualValues(t, 2, total)
		require.Len(t, logs, 2)
		require.Equal(t, model.AppWalletLogTypeReserve, logs[0].Type)
		require.Equal(t, model.AppWalletLogTypeSettle, logs[1].Type)

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
		require.EqualValues(t, 3, total)
		require.Len(t, logs, 3)

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

		updatedUser, err := model.UpdateAppUserAccount(user.ID, "New@Example.com", " 13800138000 ")
		require.NoError(t, err)
		require.Equal(t, "new@example.com", string(updatedUser.Email))
		require.Equal(t, "13800138000", string(updatedUser.Phone))
	})
}

func TestUpdateAppUserAccountInvalid(t *testing.T) {
	withTestAppWalletDB(t, func() {
		user := createTestAppUser(t)

		_, err := model.UpdateAppUserAccount(user.ID, "", "")
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
		require.EqualValues(t, 3, total)
		require.Len(t, logs, 3)
		for _, log := range logs {
			require.Equal(t, model.AppWalletLogTypeReserve, log.Type)
			require.Equal(t, reserveAmount, log.Amount)
		}
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
		&model.AppUserWallet{},
		&model.AppRechargeLog{},
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

	user := &model.AppUser{
		Email:        model.EmptyNullString("wallet@example.com"),
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
