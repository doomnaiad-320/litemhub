package model_test

import (
	"path/filepath"
	"testing"

	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
)

func TestGetEnabledGroupsOnlyReturnsEnabled(t *testing.T) {
	withTestGroupDB(t, func() {
		require.NoError(t, model.DB.Create(&model.Group{ID: "enabled-a", Status: model.GroupStatusEnabled}).Error)
		require.NoError(t, model.DB.Create(&model.Group{ID: "disabled-a", Status: model.GroupStatusDisabled}).Error)
		require.NoError(t, model.DB.Create(&model.Group{ID: "internal-a", Status: model.GroupStatusInternal}).Error)
		require.NoError(t, model.DB.Create(&model.Group{ID: "enabled-b", Status: model.GroupStatusEnabled}).Error)

		groups, err := model.GetEnabledGroups()
		require.NoError(t, err)
		require.Len(t, groups, 2)
		require.Equal(t, "enabled-a", groups[0].ID)
		require.Equal(t, "enabled-b", groups[1].ID)
	})
}

func TestEnsureGroupEnabled(t *testing.T) {
	withTestGroupDB(t, func() {
		require.NoError(t, model.DB.Create(&model.Group{ID: "enabled-a", Status: model.GroupStatusEnabled}).Error)
		require.NoError(t, model.DB.Create(&model.Group{ID: "disabled-a", Status: model.GroupStatusDisabled}).Error)

		group, err := model.EnsureGroupEnabled("enabled-a")
		require.NoError(t, err)
		require.Equal(t, "enabled-a", group.ID)

		_, err = model.EnsureGroupEnabled("disabled-a")
		require.ErrorIs(t, err, model.ErrGroupUnavailable)
	})
}

func withTestGroupDB(t *testing.T, fn func()) {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LogDB

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "group_selection_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Group{}))

	model.DB = db
	model.LogDB = db

	t.Cleanup(func() {
		model.DB = oldDB
		model.LogDB = oldLogDB

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	fn()
}
