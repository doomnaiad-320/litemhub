package model

import (
	"errors"
	"strings"

	"github.com/labring/aiproxy/core/common"
	"gorm.io/gorm"
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
	if code == "" {
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
		return code, nil
	}
	if !errors.Is(err, ErrAppUserDiscountCodeNotFound) {
		return nil, err
	}

	for range 8 {
		code = &AppUserDiscountCode{
			UserID: userID,
			Code:   "AP" + strings.ToUpper(common.ShortUUID()[:10]),
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
