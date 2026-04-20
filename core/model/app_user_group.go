package model

import (
	"errors"

	"gorm.io/gorm"
)

const (
	ErrAppUserGroupNotFound = "app_user_group"
)

var (
	ErrAppUserGroupAccessDenied = errors.New("group is not available for user")
)

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

func DeleteAppUserGroup(userID int, groupID string) error {
	if userID == 0 {
		return errors.New("user id is empty")
	}

	if groupID == "" {
		return errors.New("group id is empty")
	}

	result := DB.
		Where("user_id = ? AND group_id = ?", userID, groupID).
		Delete(&AppUserGroup{})

	return HandleUpdateResult(result, ErrAppUserGroupNotFound)
}
