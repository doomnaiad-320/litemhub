package model

import (
	"errors"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm/clause"
)

type UpdateAppUserTokenRequest struct {
	GroupID   string
	Models    *[]string
	Quota     *float64
	ExpiredAt *int64
}

func GetAppUserTokens(
	userID int,
	group string,
	page, perPage int,
	order string,
	status int,
) (tokens []*Token, total int64, err error) {
	if userID == 0 {
		return nil, 0, errors.New("user id is empty")
	}

	tx := appUserTokenQuery(userID)
	if group != "" {
		tx = tx.Where("group_id = ?", group)
	}

	if status != 0 {
		tx = tx.Where("status = ?", status)
	}

	err = tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.Order(getTokenOrder(order)).Limit(limit).Offset(offset).Find(&tokens).Error

	return tokens, total, err
}

func GetAppUserTokenByID(userID, id int) (*Token, error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	if id == 0 {
		return nil, errors.New("id is empty")
	}

	token := Token{}
	err := appUserTokenQuery(userID).Where("id = ?", id).First(&token).Error

	return &token, HandleNotFound(err, ErrTokenNotFound)
}

func CreateAppUserToken(userID int, token *Token) error {
	if userID == 0 {
		return errors.New("user id is empty")
	}

	if token == nil {
		return errors.New("token is nil")
	}

	if token.GroupID == "" {
		return errors.New("group is empty")
	}

	if _, err := EnsureGroupEnabled(token.GroupID); err != nil {
		return err
	}

	token.OwnerUserID = userID
	if token.Status == 0 {
		token.Status = TokenStatusEnabled
	}

	return InsertToken(token, false, false)
}

func DeleteAppUserTokenByID(userID, id int) (err error) {
	if userID == 0 {
		return errors.New("user id is empty")
	}

	if id == 0 {
		return errors.New("id is empty")
	}

	token := Token{}
	defer func() {
		if err == nil && token.Key != "" {
			if err := CacheDeleteToken(token.Key); err != nil {
				log.Error("delete token from cache failed: " + err.Error())
			}
		}
	}()

	result := appUserTokenQuery(userID).
		Clauses(clause.Returning{
			Columns: []clause.Column{
				{Name: "key"},
			},
		}).
		Where("id = ?", id).
		Delete(&token)

	return HandleUpdateResult(result, ErrTokenNotFound)
}

func UpdateAppUserTokenGroupByID(userID, id int, groupID string) (token *Token, err error) {
	return UpdateAppUserTokenByID(userID, id, UpdateAppUserTokenRequest{GroupID: groupID})
}

func UpdateAppUserTokenByID(userID, id int, update UpdateAppUserTokenRequest) (token *Token, err error) {
	if userID == 0 {
		return nil, errors.New("user id is empty")
	}

	if id == 0 {
		return nil, errors.New("id is empty")
	}

	if update.GroupID == "" {
		return nil, errors.New("group is empty")
	}

	if _, err := EnsureGroupEnabled(update.GroupID); err != nil {
		return nil, err
	}
	if update.Quota != nil && *update.Quota < 0 {
		return nil, errors.New("quota must be greater than or equal to 0")
	}
	if update.ExpiredAt != nil && *update.ExpiredAt < 0 {
		return nil, errors.New("expired_at is invalid")
	}

	token = &Token{ID: id}
	defer func() {
		if err == nil && token.Key != "" {
			if err := CacheDeleteToken(token.Key); err != nil {
				log.Error("delete token from cache failed: " + err.Error())
			}
		}
	}()

	updates := map[string]any{
		"group_id": update.GroupID,
	}
	if update.Models != nil {
		updates["models"] = *update.Models
	}
	if update.Quota != nil {
		updates["quota"] = *update.Quota
	}
	if update.ExpiredAt != nil {
		if *update.ExpiredAt > 0 {
			updates["expired_at"] = time.UnixMilli(*update.ExpiredAt)
		} else {
			updates["expired_at"] = nil
		}
	}

	result := appUserTokenQuery(userID).
		Clauses(clause.Returning{}).
		Where("id = ?", id).
		Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}

	result = appUserTokenQuery(userID).
		Where("id = ?", id).
		First(token)

	return token, HandleUpdateResult(result, ErrTokenNotFound)
}
