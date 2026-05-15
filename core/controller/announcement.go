package controller

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller/utils"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"gorm.io/gorm"
)

var announcementSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)
var announcementMarkdownFencePattern = regexp.MustCompile("(?is)^```(?:markdown|md|mdx|text)?[ \t]*\n([\\s\\S]*?)\n```[ \t]*$")

type AnnouncementRequest struct {
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	Summary     string `json:"summary"`
	Content     string `json:"content"`
	Category    string `json:"category"`
	Version     string `json:"version"`
	Status      int    `json:"status"`
	PublishedAt *int64 `json:"published_at"`
}

type AnnouncementStatusRequest struct {
	Status      int    `json:"status"`
	PublishedAt *int64 `json:"published_at"`
}

type AnnouncementResponse struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Slug        string `json:"slug,omitempty"`
	Summary     string `json:"summary,omitempty"`
	Content     string `json:"content"`
	Category    string `json:"category,omitempty"`
	Version     string `json:"version,omitempty"`
	Status      int    `json:"status"`
	PublishedAt int64  `json:"published_at,omitempty"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

func GetAnnouncements(c *gin.Context) {
	page, perPage := utils.ParsePageParams(c)
	keyword := c.Query("keyword")
	category := c.Query("category")
	status, _ := strconv.Atoi(c.Query("status"))

	announcements, total, err := model.GetAnnouncements(keyword, category, status, page, perPage)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"announcements": buildAnnouncementResponses(announcements),
		"total":         total,
	})
}

func GetAnnouncement(c *gin.Context) {
	announcement, ok := getAnnouncementFromParam(c)
	if !ok {
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"announcement": buildAnnouncementResponse(announcement),
	})
}

func GetAnnouncementCategories(c *gin.Context) {
	categories, err := model.GetAnnouncementCategories(false)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"categories": categories,
	})
}

func CreateAnnouncement(c *gin.Context) {
	req := AnnouncementRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	announcement, err := buildAnnouncementFromRequest(req)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	if err = model.CreateAnnouncement(announcement); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	if announcement.Slug == "" {
		announcement.Slug = model.EmptyNullString(buildAnnouncementSlug(announcement.Title, announcement.ID))
		_ = model.UpdateAnnouncement(announcement)
	}

	middleware.SuccessResponse(c, gin.H{
		"announcement": buildAnnouncementResponse(announcement),
	})
}

func UpdateAnnouncement(c *gin.Context) {
	announcement, ok := getAnnouncementFromParam(c)
	if !ok {
		return
	}

	req := AnnouncementRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	updated, err := buildAnnouncementFromRequest(req)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	announcement.Title = updated.Title
	announcement.Slug = updated.Slug
	announcement.Summary = updated.Summary
	announcement.Content = updated.Content
	announcement.Category = updated.Category
	announcement.Version = updated.Version
	announcement.Status = updated.Status
	announcement.PublishedAt = updated.PublishedAt
	if announcement.Slug == "" {
		announcement.Slug = model.EmptyNullString(buildAnnouncementSlug(announcement.Title, announcement.ID))
	}

	if err = model.UpdateAnnouncement(announcement); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"announcement": buildAnnouncementResponse(announcement),
	})
}

func DeleteAnnouncement(c *gin.Context) {
	id, ok := parseAnnouncementID(c)
	if !ok {
		return
	}

	if err := model.DeleteAnnouncement(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "announcement not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

func UpdateAnnouncementStatus(c *gin.Context) {
	announcement, ok := getAnnouncementFromParam(c)
	if !ok {
		return
	}

	req := AnnouncementStatusRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}
	if !model.IsAnnouncementStatusValid(req.Status) {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid announcement status")
		return
	}

	announcement.Status = req.Status
	announcement.PublishedAt = parseAnnouncementPublishedAt(req.PublishedAt)
	if req.Status == model.AnnouncementStatusPublished && announcement.PublishedAt == nil {
		now := time.Now()
		announcement.PublishedAt = &now
	}

	if err := model.UpdateAnnouncement(announcement); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"announcement": buildAnnouncementResponse(announcement),
	})
}

func GetPublicAnnouncements(c *gin.Context) {
	page, perPage := utils.ParsePageParams(c)
	category := c.Query("category")

	announcements, total, err := model.GetPublishedAnnouncements(category, page, perPage)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"announcements": buildAnnouncementResponses(announcements),
		"total":         total,
	})
}

func GetPublicAnnouncementCategories(c *gin.Context) {
	categories, err := model.GetAnnouncementCategories(true)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"categories": categories,
	})
}

func buildAnnouncementFromRequest(req AnnouncementRequest) (*model.Announcement, error) {
	title := strings.TrimSpace(req.Title)
	content := normalizeAnnouncementMarkdown(req.Content)
	if title == "" {
		return nil, errors.New("title is required")
	}
	if content == "" {
		return nil, errors.New("content is required")
	}

	status := req.Status
	if status == 0 {
		status = model.AnnouncementStatusDraft
	}
	if !model.IsAnnouncementStatusValid(status) {
		return nil, errors.New("invalid announcement status")
	}

	publishedAt := parseAnnouncementPublishedAt(req.PublishedAt)
	if status == model.AnnouncementStatusPublished && publishedAt == nil {
		now := time.Now()
		publishedAt = &now
	}

	return &model.Announcement{
		Title:       title,
		Slug:        model.EmptyNullString(normalizeAnnouncementSlug(req.Slug)),
		Summary:     strings.TrimSpace(req.Summary),
		Content:     content,
		Category:    model.EmptyNullString(strings.TrimSpace(req.Category)),
		Version:     model.EmptyNullString(strings.TrimSpace(req.Version)),
		Status:      status,
		PublishedAt: publishedAt,
	}, nil
}

func parseAnnouncementPublishedAt(timestamp *int64) *time.Time {
	if timestamp == nil || *timestamp <= 0 {
		return nil
	}

	value := *timestamp
	var parsed time.Time
	switch {
	case value <= 9999999999:
		parsed = time.Unix(value, 0)
	case value <= 9999999999999:
		parsed = time.UnixMilli(value)
	default:
		parsed = time.Unix(0, value)
	}

	return &parsed
}

func buildAnnouncementResponses(announcements []*model.Announcement) []*AnnouncementResponse {
	responses := make([]*AnnouncementResponse, 0, len(announcements))
	for _, announcement := range announcements {
		responses = append(responses, buildAnnouncementResponse(announcement))
	}

	return responses
}

func buildAnnouncementResponse(announcement *model.Announcement) *AnnouncementResponse {
	if announcement == nil {
		return nil
	}

	response := &AnnouncementResponse{
		ID:        announcement.ID,
		Title:     announcement.Title,
		Slug:      announcement.Slug.String(),
		Summary:   announcement.Summary,
		Content:   normalizeAnnouncementMarkdown(announcement.Content),
		Category:  announcement.Category.String(),
		Version:   announcement.Version.String(),
		Status:    announcement.Status,
		CreatedAt: announcement.CreatedAt.UnixMilli(),
		UpdatedAt: announcement.UpdatedAt.UnixMilli(),
	}
	if announcement.PublishedAt != nil {
		response.PublishedAt = announcement.PublishedAt.UnixMilli()
	}

	return response
}

func parseAnnouncementID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid announcement id")
		return 0, false
	}

	return id, true
}

func getAnnouncementFromParam(c *gin.Context) (*model.Announcement, bool) {
	id, ok := parseAnnouncementID(c)
	if !ok {
		return nil, false
	}

	announcement, err := model.GetAnnouncementByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "announcement not found")
			return nil, false
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return nil, false
	}

	return announcement, true
}

func normalizeAnnouncementSlug(slug string) string {
	slug = strings.ToLower(strings.TrimSpace(slug))
	slug = announcementSlugPattern.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")

	return slug
}

func normalizeAnnouncementMarkdown(content string) string {
	content = strings.TrimPrefix(content, "\uFEFF")
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	content = strings.TrimSpace(content)

	if match := announcementMarkdownFencePattern.FindStringSubmatch(content); len(match) == 2 {
		content = strings.TrimSpace(match[1])
	}

	return content
}

func buildAnnouncementSlug(title string, id int) string {
	base := normalizeAnnouncementSlug(title)
	if base == "" {
		base = "announcement"
	}

	return base + "-" + strconv.Itoa(id)
}
