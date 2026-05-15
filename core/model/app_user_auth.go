package model

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const (
	ErrAppUserNotFound = "app_user"
)

var (
	ErrAppUserAlreadyExists     = errors.New("username, email or phone already exists")
	ErrAppUserStatusInvalid     = errors.New("invalid app user status")
	ErrAppUserAccountInvalid    = errors.New("username, email or phone is required")
	ErrAppUserPasswordHashEmpty = errors.New("password hash is empty")
)

func normalizeAppUserUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func SanitizeAppUserUsernameSeed(seed string) string {
	var builder strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(seed)) {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '_' || r == '-':
			builder.WriteRune(r)
		default:
			builder.WriteRune('-')
		}
	}

	username := strings.Trim(builder.String(), "-_")
	if len(username) < 3 {
		username = "user-" + username
	}
	if len(username) > 24 {
		username = username[:24]
	}

	return username
}

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

	user.Username = EmptyNullString(normalizeAppUserUsername(string(user.Username)))
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

func BackfillAppUserUsernames() error {
	var users []*AppUser
	if err := DB.Where("username IS NULL OR username = ''").Find(&users).Error; err != nil {
		return err
	}

	for _, user := range users {
		if user == nil || user.ID == 0 {
			continue
		}

		username := buildBackfillAppUserUsername(user)
		if err := updateAppUserUsernameWithRetry(user.ID, username); err != nil {
			return err
		}
	}

	return nil
}

func buildBackfillAppUserUsername(user *AppUser) string {
	if user == nil {
		return "user"
	}

	seed := string(user.Email)
	if index := strings.Index(seed, "@"); index > 0 {
		seed = seed[:index]
	}
	if strings.TrimSpace(seed) == "" {
		seed = string(user.Phone)
	}
	if strings.TrimSpace(seed) == "" {
		seed = fmt.Sprintf("user-%d", user.ID)
	}

	return SanitizeAppUserUsernameSeed(seed)
}

func updateAppUserUsernameWithRetry(userID int, baseUsername string) error {
	for attempt := 0; attempt < 100; attempt++ {
		username := baseUsername
		if attempt > 0 {
			username = fmt.Sprintf("%s-%d", baseUsername, attempt+1)
			if len(username) > 32 {
				suffix := fmt.Sprintf("-%d", attempt+1)
				username = baseUsername[:32-len(suffix)] + suffix
			}
		}

		err := DB.Session(&gorm.Session{SkipHooks: true}).
			Model(&AppUser{}).
			Where("id = ?", userID).
			Update("username", EmptyNullString(username)).Error
		if err == nil {
			return nil
		}
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return err
		}
	}

	return fmt.Errorf("failed to generate unique username for app user %d", userID)
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

func GetAppUserByUsername(username string) (*AppUser, error) {
	username = normalizeAppUserUsername(username)
	if username == "" {
		return nil, errors.New("username is empty")
	}

	var user AppUser
	err := DB.Where("username = ?", username).First(&user).Error

	return &user, HandleNotFound(err, ErrAppUserNotFound)
}

func GetAppUserByEmailOrUsername(account string) (*AppUser, error) {
	account = strings.TrimSpace(account)
	if account == "" {
		return nil, errors.New("account is empty")
	}

	if strings.Contains(account, "@") {
		return GetAppUserByEmail(account)
	}

	return GetAppUserByUsername(account)
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

func UpdateAppUserAccount(id int, username, email, phone string) (*AppUser, error) {
	if id == 0 {
		return nil, errors.New("id is empty")
	}

	username = normalizeAppUserUsername(username)
	email = normalizeAppUserEmail(email)
	phone = normalizeAppUserPhone(phone)
	if username == "" && email == "" && phone == "" {
		return nil, ErrAppUserAccountInvalid
	}

	user, err := GetAppUserByID(id)
	if err != nil {
		return nil, err
	}

	if string(user.Username) == username && string(user.Email) == email && string(user.Phone) == phone {
		return user, nil
	}

	if err = DB.Session(&gorm.Session{SkipHooks: true}).
		Model(&AppUser{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"username": EmptyNullString(username),
			"email":    EmptyNullString(email),
			"phone":    EmptyNullString(phone),
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
