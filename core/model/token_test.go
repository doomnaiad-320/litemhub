package model_test

import (
	"path/filepath"
	"testing"

	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
)

func TestCreateAppUserTokenAllowsDuplicateNameInSameGroup(t *testing.T) {
	withTestTokenDB(t, func() {
		user := &model.AppUser{
			Username:     model.EmptyNullString("token-user"),
			PasswordHash: "hashed-password",
			Status:       model.AppUserStatusEnabled,
		}
		require.NoError(t, model.DB.Create(user).Error)
		require.NoError(t, model.DB.Create(&model.Group{ID: "default", Status: model.GroupStatusEnabled}).Error)

		first := &model.Token{
			Name:    model.EmptyNullString("same-name"),
			GroupID: "default",
		}
		second := &model.Token{
			Name:    model.EmptyNullString("same-name"),
			GroupID: "default",
		}

		require.NoError(t, model.CreateAppUserToken(user.ID, first))
		require.NoError(t, model.CreateAppUserToken(user.ID, second))
		require.NotZero(t, first.ID)
		require.NotZero(t, second.ID)
		require.NotEqual(t, first.ID, second.ID)
	})
}

func TestInsertTokenRejectsDuplicateAdminNameInSameGroup(t *testing.T) {
	withTestTokenDB(t, func() {
		require.NoError(t, model.DB.Create(&model.Group{ID: "default", Status: model.GroupStatusEnabled}).Error)

		first := &model.Token{
			Name:    model.EmptyNullString("same-name"),
			GroupID: "default",
		}
		second := &model.Token{
			Name:    model.EmptyNullString("same-name"),
			GroupID: "default",
		}

		require.NoError(t, model.InsertToken(first, false, false))
		require.EqualError(t, model.InsertToken(second, false, false), "token name already exists in this group")
	})
}

func TestMigrateDBDropsTokenGroupNameUniqueIndex(t *testing.T) {
	withTestTokenDB(t, func() {
		require.False(t, model.DB.Migrator().HasIndex(&model.Token{}, "idx_group_name"))
	})
}

func withTestTokenDB(t *testing.T, fn func()) {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LogDB
	oldUsingSQLite := common.UsingSQLite

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "token_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Group{},
		&model.AppUser{},
		&model.Token{},
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
