package model

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const (
	ErrAppUserGroupNotFound = "app_user_group"
)

var (
	ErrAppUserGroupAccessDenied = errors.New("group is not available for user")
)

type AppUserGroupPriceMultiplier struct {
	GroupID                 string   `json:"group"                     gorm:"column:group_id"`
	Description             string   `json:"description,omitempty"     gorm:"column:description"`
	GroupPriceMultiplier    float64  `json:"group_price_multiplier"    gorm:"column:group_price_multiplier"`
	PriceMultiplierOverride *float64 `json:"price_multiplier_override" gorm:"column:price_multiplier_override"`
}

func GetAppUserGroups(userID int, onlyEnabledGroup bool) (groups []*Group, err error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	tx := DB.Table("groups AS g").
		Select("g.*").
		Joins("JOIN app_user_group aug ON aug.group_id = g.id").
		Where("aug.user_id = ?", userID).
		Where("aug.status = ?", AppUserGroupStatusEnabled)

	if onlyEnabledGroup {
		tx = tx.Where("g.status = ?", GroupStatusEnabled)
	}

	err = tx.Order("g.id asc").Scan(&groups).Error

	return groups, err
}

func GetAppUserGroupPriceMultipliers(
	userID int,
	keyword string,
	page, perPage int,
) (items []*AppUserGroupPriceMultiplier, total int64, err error) {
	if userID == 0 {
		return nil, 0, errors.New("user id is empty")
	}

	if _, err := GetAppUserByID(userID); err != nil {
		return nil, 0, err
	}

	keyword = strings.TrimSpace(keyword)
	tx := DB.Table("groups AS g").
		Where("g.status = ?", GroupStatusEnabled)
	if keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("g.id LIKE ? OR g.description LIKE ?", like, like)
	}

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.
		Select(`
			g.id AS group_id,
			g.description,
			g.price_multiplier AS group_price_multiplier,
			aug.price_multiplier_override
		`).
		Joins(
			`LEFT JOIN app_user_group aug
				ON aug.group_id = g.id
				AND aug.user_id = ?
				AND aug.status = ?`,
			userID,
			AppUserGroupStatusEnabled,
		).
		Order("g.id asc").
		Limit(limit).
		Offset(offset).
		Scan(&items).
		Error

	return items, total, err
}

func EnsureAppUserCanUseGroup(userID int, groupID string) (*Group, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	if groupID == "" {
		return nil, errors.New("group id is empty")
	}

	var group Group
	err := DB.Table("groups AS g").
		Select("g.*").
		Joins("JOIN app_user_group aug ON aug.group_id = g.id").
		Where("aug.user_id = ?", userID).
		Where("aug.group_id = ?", groupID).
		Where("aug.status = ?", AppUserGroupStatusEnabled).
		Where("g.status = ?", GroupStatusEnabled).
		First(&group).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppUserGroupAccessDenied
		}

		return nil, err
	}

	return &group, nil
}

func SaveAppUserGroup(userID int, groupID string) error {
	if userID == 0 {
		return errors.New("user id is empty")
	}

	if groupID == "" {
		return errors.New("group id is empty")
	}

	if _, err := GetAppUserByID(userID); err != nil {
		return err
	}

	if _, err := GetGroupByID(groupID, false); err != nil {
		return err
	}

	relation := &AppUserGroup{
		UserID:  userID,
		GroupID: groupID,
	}

	return DB.
		Where("user_id = ? AND group_id = ?", userID, groupID).
		Assign(AppUserGroup{Status: AppUserGroupStatusEnabled}).
		FirstOrCreate(relation).
		Error
}

func GetAppUserGroupPriceMultiplierOverride(
	userID int,
	groupID string,
) (*float64, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	if groupID == "" {
		return nil, errors.New("group id is empty")
	}

	var relation AppUserGroup
	err := DB.
		Select("price_multiplier_override").
		Where("user_id = ?", userID).
		Where("group_id = ?", groupID).
		Where("status = ?", AppUserGroupStatusEnabled).
		First(&relation).
		Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}

		return nil, err
	}

	return relation.PriceMultiplierOverride, nil
}

func SetAppUserGroupPriceMultiplierOverride(
	userID int,
	groupID string,
	priceMultiplierOverride *float64,
) error {
	if userID == 0 {
		return errors.New("user id is empty")
	}

	if groupID == "" {
		return errors.New("group id is empty")
	}

	if priceMultiplierOverride != nil {
		switch {
		case *priceMultiplierOverride < 0:
			return fmt.Errorf("price multiplier override must be greater than or equal to 0")
		case *priceMultiplierOverride == 0:
			priceMultiplierOverride = nil
		}
	}

	if _, err := GetAppUserByID(userID); err != nil {
		return err
	}

	if _, err := GetGroupByID(groupID, false); err != nil {
		return err
	}

	tokenKeys := []string{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		relation := &AppUserGroup{
			UserID:  userID,
			GroupID: groupID,
		}
		if err := tx.
			Where("user_id = ? AND group_id = ?", userID, groupID).
			FirstOrCreate(relation).
			Error; err != nil {
			return err
		}

		if err := tx.
			Table((&AppUserGroup{}).TableName()).
			Where("user_id = ? AND group_id = ?", userID, groupID).
			Updates(map[string]any{
				"status":                    AppUserGroupStatusEnabled,
				"price_multiplier_override": priceMultiplierOverride,
			}).
			Error; err != nil {
			return err
		}

		if err := tx.
			Model(&Token{}).
			Select("key").
			Where("owner_user_id = ?", userID).
			Where("group_id = ?", groupID).
			Pluck("key", &tokenKeys).
			Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return err
	}

	for _, key := range tokenKeys {
		if key == "" {
			continue
		}

		if err := CacheDeleteToken(key); err != nil {
			return err
		}
	}

	return nil
}

func DeleteAppUserGroup(userID int, groupID string) error {
	if userID == 0 {
		return errors.New("user id is empty")
	}

	if groupID == "" {
		return errors.New("group id is empty")
	}

	tokenKeys := []string{}
	result := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Model(&Token{}).
			Where("owner_user_id = ?", userID).
			Where("group_id = ?", groupID).
			Pluck("key", &tokenKeys).
			Error; err != nil {
			return err
		}

		result := tx.
			Where("user_id = ? AND group_id = ?", userID, groupID).
			Delete(&AppUserGroup{})

		return HandleUpdateResult(result, ErrAppUserGroupNotFound)
	})
	if result != nil {
		return result
	}

	for _, key := range tokenKeys {
		if key == "" {
			continue
		}

		if err := CacheDeleteToken(key); err != nil {
			return err
		}
	}

	return nil
}
