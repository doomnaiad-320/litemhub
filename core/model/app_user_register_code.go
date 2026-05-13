package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const ErrAppUserRegisterCodeNotFound = "app_user_register_code"

type AppUserRegisterCode struct {
	ID        int           `json:"id" gorm:"primaryKey"`
	Email     EmptyNullString `json:"email" gorm:"size:255;uniqueIndex;not null"`
	CodeHash  string        `json:"-" gorm:"size:64;not null"`
	Attempts  int           `json:"attempts" gorm:"not null;default:0"`
	ExpiresAt time.Time     `json:"expires_at" gorm:"index;not null"`
	LastSentAt time.Time    `json:"last_sent_at" gorm:"index;not null"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

func (*AppUserRegisterCode) TableName() string {
	return "app_user_register_code"
}

func GetAppUserRegisterCodeByEmail(email string) (*AppUserRegisterCode, error) {
	email = normalizeAppUserEmail(email)
	if email == "" {
		return nil, errors.New("email is empty")
	}

	var record AppUserRegisterCode
	err := DB.Where("email = ?", email).First(&record).Error

	return &record, HandleNotFound(err, ErrAppUserRegisterCodeNotFound)
}

func UpsertAppUserRegisterCode(email, codeHash string, attempts int, expiresAt, lastSentAt time.Time) (*AppUserRegisterCode, error) {
	email = normalizeAppUserEmail(email)
	if email == "" {
		return nil, errors.New("email is empty")
	}

	record := &AppUserRegisterCode{
		Email:     EmptyNullString(email),
		CodeHash:  codeHash,
		Attempts:  attempts,
		ExpiresAt: expiresAt,
		LastSentAt: lastSentAt,
	}

	err := DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "email"}},
		DoUpdates: clause.Assignments(map[string]any{
			"code_hash":   codeHash,
			"attempts":    attempts,
			"expires_at":  expiresAt,
			"last_sent_at": lastSentAt,
		}),
	}).Create(record).Error
	if err != nil {
		return nil, err
	}

	return GetAppUserRegisterCodeByEmail(email)
}

func UpdateAppUserRegisterCodeAttempts(email string, attempts int) error {
	email = normalizeAppUserEmail(email)
	if email == "" {
		return errors.New("email is empty")
	}

	return DB.Session(&gorm.Session{SkipHooks: true}).
		Model(&AppUserRegisterCode{}).
		Where("email = ?", email).
		Update("attempts", attempts).Error
}

func DeleteAppUserRegisterCodeByEmail(email string) error {
	email = normalizeAppUserEmail(email)
	if email == "" {
		return errors.New("email is empty")
	}

	return DB.Where("email = ?", email).Delete(&AppUserRegisterCode{}).Error
}
