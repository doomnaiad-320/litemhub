package model

import (
	"path/filepath"
	"testing"

	"github.com/labring/aiproxy/core/common"
	"github.com/stretchr/testify/require"
)

func TestMigrateTokenIndexesDropsLegacyGroupNameUniqueIndex(t *testing.T) {
	oldDB := DB
	oldLogDB := LogDB
	oldUsingSQLite := common.UsingSQLite

	db, err := OpenSQLite(filepath.Join(t.TempDir(), "legacy_token_index.db"))
	require.NoError(t, err)

	DB = db
	LogDB = db
	common.UsingSQLite = true

	t.Cleanup(func() {
		DB = oldDB
		LogDB = oldLogDB
		common.UsingSQLite = oldUsingSQLite

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, db.AutoMigrate(&Group{}, &AppUser{}, &Token{}))
	require.NoError(t, db.Exec("CREATE UNIQUE INDEX idx_group_name ON tokens(group_id, name)").Error)
	require.True(t, db.Migrator().HasIndex(&Token{}, "idx_group_name"))

	require.NoError(t, migrateTokenIndexes(db))
	require.False(t, db.Migrator().HasIndex(&Token{}, "idx_group_name"))

	require.NoError(t, db.Create(&Group{ID: "default", Status: GroupStatusEnabled}).Error)
	require.NoError(t, db.Create(&AppUser{
		Username:     EmptyNullString("token-user"),
		PasswordHash: "hashed-password",
		Status:       AppUserStatusEnabled,
	}).Error)

	first := &Token{
		Name:        EmptyNullString("same-name"),
		GroupID:     "default",
		OwnerUserID: 1,
	}
	second := &Token{
		Name:        EmptyNullString("same-name"),
		GroupID:     "default",
		OwnerUserID: 1,
	}
	require.NoError(t, db.Create(first).Error)
	require.NoError(t, db.Create(second).Error)
}
