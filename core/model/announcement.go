package model

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	AnnouncementStatusDraft     = 1
	AnnouncementStatusPublished = 2
)

type Announcement struct {
	ID          int             `json:"id"           gorm:"primaryKey"`
	Title       string          `json:"title"        gorm:"size:255;not null"`
	Slug        EmptyNullString `json:"slug"         gorm:"size:160;uniqueIndex"`
	Summary     string          `json:"summary"      gorm:"size:512"`
	Content     string          `json:"content"      gorm:"type:text;not null"`
	Category    EmptyNullString `json:"category"     gorm:"size:64;index"`
	Version     EmptyNullString `json:"version"      gorm:"size:64"`
	Status      int             `json:"status"       gorm:"default:1;index"`
	PublishedAt *time.Time      `json:"published_at" gorm:"index"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (*Announcement) TableName() string {
	return "announcement"
}

func IsAnnouncementStatusValid(status int) bool {
	switch status {
	case AnnouncementStatusDraft, AnnouncementStatusPublished:
		return true
	default:
		return false
	}
}

func CreateAnnouncement(announcement *Announcement) error {
	return DB.Create(announcement).Error
}

func GetAnnouncementByID(id int) (*Announcement, error) {
	announcement := &Announcement{}
	err := DB.First(announcement, id).Error

	return announcement, err
}

func UpdateAnnouncement(announcement *Announcement) error {
	return DB.Save(announcement).Error
}

func DeleteAnnouncement(id int) error {
	return HandleUpdateResult(DB.Delete(&Announcement{}, id), "announcement")
}

func GetAnnouncements(keyword, category string, status int, page, perPage int) (
	announcements []*Announcement,
	total int64,
	err error,
) {
	tx := DB.Model(&Announcement{})
	tx = applyAnnouncementFilters(tx, keyword, category, status, false)

	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.
		Order("COALESCE(published_at, updated_at) desc, id desc").
		Limit(limit).
		Offset(offset).
		Find(&announcements).Error

	return announcements, total, err
}

func GetPublishedAnnouncements(category string, page, perPage int) (
	announcements []*Announcement,
	total int64,
	err error,
) {
	tx := applyAnnouncementFilters(DB.Model(&Announcement{}), "", category, AnnouncementStatusPublished, true)

	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total <= 0 {
		return nil, 0, nil
	}

	limit, offset := toLimitOffset(page, perPage)
	err = tx.
		Order("published_at desc, id desc").
		Limit(limit).
		Offset(offset).
		Find(&announcements).Error

	return announcements, total, err
}

func GetAnnouncementCategories(publishedOnly bool) (categories []string, err error) {
	tx := DB.Model(&Announcement{}).
		Where("category IS NOT NULL AND category <> ''")
	if publishedOnly {
		tx = tx.
			Where("status = ?", AnnouncementStatusPublished).
			Where("published_at IS NOT NULL AND published_at <= ?", time.Now())
	}

	err = tx.
		Distinct("category").
		Order("category asc").
		Pluck("category", &categories).
		Error

	return categories, err
}

func applyAnnouncementFilters(tx *gorm.DB, keyword, category string, status int, publishedOnly bool) *gorm.DB {
	if status != 0 {
		tx = tx.Where("status = ?", status)
	}
	if publishedOnly {
		tx = tx.Where("published_at IS NOT NULL AND published_at <= ?", time.Now())
	}

	category = strings.TrimSpace(category)
	if category != "" {
		tx = tx.Where("category = ?", category)
	}

	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		likeKeyword := "%" + keyword + "%"
		tx = tx.Where(
			"title LIKE ? OR summary LIKE ? OR category LIKE ? OR version LIKE ?",
			likeKeyword,
			likeKeyword,
			likeKeyword,
			likeKeyword,
		)
	}

	return tx
}
