package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

const (
	ErrAppUserNotFound = "app_user"
)

var (
	ErrAppUserAlreadyExists     = errors.New("email or phone already exists")
	ErrAppUserStatusInvalid     = errors.New("invalid app user status")
	ErrAppUserAccountInvalid    = errors.New("email or phone is required")
	ErrAppUserPasswordHashEmpty = errors.New("password hash is empty")
)

func normalizeAppUserEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeAppUserPhone(phone string) string {
	return strings.TrimSpace(phone)
}

func CreateAppUserWithWallet(user *AppUser) error {
	if user == nil {
		return errors.New("user is nil")
	}

	user.Email = EmptyNullString(normalizeAppUserEmail(string(user.Email)))
	user.Phone = EmptyNullString(normalizeAppUserPhone(string(user.Phone)))

	if user.Status == 0 {
		user.Status = AppUserStatusEnabled
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return ErrAppUserAlreadyExists
			}

			return err
		}

		wallet := &AppUserWallet{
			UserID: user.ID,
		}

		if err := tx.Create(wallet).Error; err != nil {
			return err
		}

		return nil
	})
}

func GetAppUserByID(id int) (*AppUser, error) {
	if id == 0 {
		return nil, errors.New("id is empty")
	}

	user := AppUser{ID: id}
	err := DB.First(&user, "id = ?", id).Error

	return &user, HandleNotFound(err, ErrAppUserNotFound)
}

func GetAppUserByEmail(email string) (*AppUser, error) {
	email = normalizeAppUserEmail(email)
	if email == "" {
		return nil, errors.New("email is empty")
	}

	var user AppUser
	err := DB.Where("email = ?", email).First(&user).Error

	return &user, HandleNotFound(err, ErrAppUserNotFound)
}

func GetAppUserByPhone(phone string) (*AppUser, error) {
	phone = normalizeAppUserPhone(phone)
	if phone == "" {
		return nil, errors.New("phone is empty")
	}

	var user AppUser
	err := DB.Where("phone = ?", phone).First(&user).Error

	return &user, HandleNotFound(err, ErrAppUserNotFound)
}

func UpdateAppUserStatus(id, status int) (*AppUser, error) {
	if id == 0 {
		return nil, errors.New("id is empty")
	}

	if !IsAppUserStatusValid(status) {
		return nil, ErrAppUserStatusInvalid
	}

	user, err := GetAppUserByID(id)
	if err != nil {
		return nil, err
	}

	if user.Status == status {
		return user, nil
	}

	if err = DB.Session(&gorm.Session{SkipHooks: true}).
		Model(&AppUser{}).
		Where("id = ?", id).
		Update("status", status).Error; err != nil {
		return nil, err
	}

	return GetAppUserByID(id)
}

func UpdateAppUserAccount(id int, email, phone string) (*AppUser, error) {
	if id == 0 {
		return nil, errors.New("id is empty")
	}

	email = normalizeAppUserEmail(email)
	phone = normalizeAppUserPhone(phone)
	if email == "" && phone == "" {
		return nil, ErrAppUserAccountInvalid
	}

	user, err := GetAppUserByID(id)
	if err != nil {
		return nil, err
	}

	if string(user.Email) == email && string(user.Phone) == phone {
		return user, nil
	}

	if err = DB.Session(&gorm.Session{SkipHooks: true}).
		Model(&AppUser{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"email": EmptyNullString(email),
			"phone": EmptyNullString(phone),
		}).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, ErrAppUserAlreadyExists
		}

		return nil, err
	}

	return GetAppUserByID(id)
}

func UpdateAppUserPasswordHash(id int, passwordHash string) (*AppUser, error) {
	if id == 0 {
		return nil, errors.New("id is empty")
	}

	passwordHash = strings.TrimSpace(passwordHash)
	if passwordHash == "" {
		return nil, ErrAppUserPasswordHashEmpty
	}

	if _, err := GetAppUserByID(id); err != nil {
		return nil, err
	}

	if err := DB.Session(&gorm.Session{SkipHooks: true}).
		Model(&AppUser{}).
		Where("id = ?", id).
		Update("password_hash", passwordHash).Error; err != nil {
		return nil, err
	}

	return GetAppUserByID(id)
}
