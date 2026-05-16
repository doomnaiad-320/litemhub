package model_test

import (
	"path/filepath"
	"testing"

	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
)

func TestUpdateDuluPayRechargeDiscountOption(t *testing.T) {
	oldDB := model.DB
	oldDiscount := config.GetDuluPayRechargeDiscount()

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "option_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))

	model.DB = db
	config.SetDuluPayRechargeDiscount(1)

	t.Cleanup(func() {
		model.DB = oldDB
		config.SetDuluPayRechargeDiscount(oldDiscount)

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, model.InitOption2DB())
	require.NoError(t, model.UpdateOption("DuluPayRechargeDiscount", "0.9"))
	require.Equal(t, 0.9, config.GetDuluPayRechargeDiscount())

	option, err := model.GetOption("DuluPayRechargeDiscount")
	require.NoError(t, err)
	require.Equal(t, "0.9", option.Value)
}

func TestUpdateDuluPayRechargeDiscountOptionRejectsInvalidValue(t *testing.T) {
	oldDiscount := config.GetDuluPayRechargeDiscount()
	config.SetDuluPayRechargeDiscount(1)
	t.Cleanup(func() {
		config.SetDuluPayRechargeDiscount(oldDiscount)
	})

	err := model.UpdateOption("DuluPayRechargeDiscount", "1.2")
	require.Error(t, err)
	require.Equal(t, 1.0, config.GetDuluPayRechargeDiscount())
}

func TestUpdateDuluPayRechargeRebateRatioOption(t *testing.T) {
	oldDB := model.DB
	oldRatio := config.GetDuluPayRechargeRebateRatio()

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "option_rebate_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))

	model.DB = db
	config.SetDuluPayRechargeRebateRatio(0)
	t.Cleanup(func() {
		model.DB = oldDB
		config.SetDuluPayRechargeRebateRatio(oldRatio)

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, model.InitOption2DB())
	require.NoError(t, model.UpdateOption("DuluPayRechargeRebateRatio", "0.1"))
	require.Equal(t, 0.1, config.GetDuluPayRechargeRebateRatio())

	option, err := model.GetOption("DuluPayRechargeRebateRatio")
	require.NoError(t, err)
	require.Equal(t, "0.1", option.Value)
}

func TestUpdateDuluPayRechargeRebateRatioOptionRejectsInvalidValue(t *testing.T) {
	oldRatio := config.GetDuluPayRechargeRebateRatio()
	config.SetDuluPayRechargeRebateRatio(0)
	t.Cleanup(func() {
		config.SetDuluPayRechargeRebateRatio(oldRatio)
	})

	err := model.UpdateOption("DuluPayRechargeRebateRatio", "1.2")
	require.Error(t, err)
	require.Equal(t, 0.0, config.GetDuluPayRechargeRebateRatio())
}
