package model

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

type LineRoute struct {
	ID          int       `json:"id"          gorm:"primaryKey"`
	APIURL      string    `json:"api_url"     gorm:"size:512;not null"`
	Description string    `json:"description" gorm:"size:255;not null"`
	Note        string    `json:"note"        gorm:"type:text"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (*LineRoute) TableName() string {
	return "line_route"
}

func CreateLineRoute(lineRoute *LineRoute) error {
	return DB.Create(lineRoute).Error
}

func GetLineRouteByID(id int) (*LineRoute, error) {
	lineRoute := &LineRoute{}
	err := DB.First(lineRoute, id).Error

	return lineRoute, err
}

func UpdateLineRoute(lineRoute *LineRoute) error {
	return DB.Save(lineRoute).Error
}

func DeleteLineRoute(id int) error {
	return HandleUpdateResult(DB.Delete(&LineRoute{}, id), "line route")
}

func GetLineRoutes(keyword string, page, perPage int) (
	lineRoutes []*LineRoute,
	total int64,
	err error,
) {
	tx := applyLineRouteFilters(DB.Model(&LineRoute{}), keyword)

	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.
		Order("updated_at desc, id desc").
		Limit(limit).
		Offset(offset).
		Find(&lineRoutes).Error

	return lineRoutes, total, err
}

func GetAllLineRoutes() ([]*LineRoute, error) {
	var lineRoutes []*LineRoute
	err := DB.
		Order("id asc").
		Find(&lineRoutes).Error

	return lineRoutes, err
}

func applyLineRouteFilters(tx *gorm.DB, keyword string) *gorm.DB {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return tx
	}

	pattern := "%" + keyword + "%"

	return tx.Where(
		"api_url LIKE ? OR description LIKE ? OR note LIKE ?",
		pattern,
		pattern,
		pattern,
	)
}
