package model

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"

	"gorm.io/gorm"
)

const (
	appUserDiscountCodeMinLength = 4
	appUserDiscountCodeMaxLength = 6
	appUserDiscountCodeAlphabet  = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

var (
	ErrAppUserDiscountCodeNotFound = errors.New("app user discount code not found")
	ErrAppUserDiscountCodeInvalid  = errors.New("discount code is invalid")
)

func NormalizeAppUserDiscountCode(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	var builder strings.Builder
	builder.Grow(len(code))
	for _, r := range code {
		switch {
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		}
	}

	return builder.String()
}

func IsAppUserDiscountCodeValid(code string) bool {
	code = NormalizeAppUserDiscountCode(code)
	if len(code) < appUserDiscountCodeMinLength || len(code) > appUserDiscountCodeMaxLength {
		return false
	}

	hasLetter := false
	hasDigit := false
	for _, r := range code {
		switch {
		case r >= 'A' && r <= 'Z':
			hasLetter = true
		case r >= '0' && r <= '9':
			hasDigit = true
		default:
			return false
		}
	}

	return hasLetter && hasDigit
}

func GetAppUserDiscountCodeByUserID(userID int) (*AppUserDiscountCode, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	code := &AppUserDiscountCode{}
	err := DB.Where("user_id = ? AND status = ?", userID, AppUserStatusEnabled).First(code).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAppUserDiscountCodeNotFound
	}

	return code, err
}

func GetAppUserDiscountCodeByCode(code string) (*AppUserDiscountCode, error) {
	code = NormalizeAppUserDiscountCode(code)
	if !IsAppUserDiscountCodeValid(code) {
		return nil, ErrAppUserDiscountCodeInvalid
	}

	discountCode := &AppUserDiscountCode{}
	err := DB.
		Where("code = ? AND status = ?", code, AppUserStatusEnabled).
		First(discountCode).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAppUserDiscountCodeNotFound
	}

	return discountCode, err
}

func GetOrCreateAppUserDiscountCode(userID int) (*AppUserDiscountCode, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	if _, err := GetAppUserByID(userID); err != nil {
		return nil, err
	}

	code, err := GetAppUserDiscountCodeByUserID(userID)
	if err == nil {
		if IsAppUserDiscountCodeValid(code.Code) {
			return code, nil
		}

		return replaceAppUserDiscountCode(code)
	}
	if !errors.Is(err, ErrAppUserDiscountCodeNotFound) {
		return nil, err
	}

	for range 16 {
		value, err := generateAppUserDiscountCodeValue()
		if err != nil {
			return nil, err
		}

		code = &AppUserDiscountCode{
			UserID: userID,
			Code:   value,
			Status: AppUserStatusEnabled,
		}
		err = DB.Create(code).Error
		if err == nil {
			return code, nil
		}
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, err
		}
	}

	return nil, errors.New("failed to generate unique discount code")
}

func replaceAppUserDiscountCode(code *AppUserDiscountCode) (*AppUserDiscountCode, error) {
	for range 16 {
		value, err := generateAppUserDiscountCodeValue()
		if err != nil {
			return nil, err
		}

		err = DB.Model(code).Update("code", value).Error
		if err == nil {
			code.Code = value
			return code, nil
		}
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, err
		}
	}

	return nil, errors.New("failed to generate unique discount code")
}

func generateAppUserDiscountCodeValue() (string, error) {
	for range 16 {
		var builder strings.Builder
		builder.Grow(appUserDiscountCodeMaxLength)
		for range appUserDiscountCodeMaxLength {
			index, err := rand.Int(rand.Reader, big.NewInt(int64(len(appUserDiscountCodeAlphabet))))
			if err != nil {
				return "", err
			}

			builder.WriteByte(appUserDiscountCodeAlphabet[index.Int64()])
		}

		code := builder.String()
		if IsAppUserDiscountCodeValid(code) {
			return code, nil
		}
	}

	return "", errors.New("failed to generate valid discount code")
}
