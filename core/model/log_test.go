package model_test

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
)

func TestRequestDetailApplyBodySizeLimits(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody:  "abcdef",
		ResponseBody: "uvwxyz",
	}

	detail.ApplyBodySizeLimits(4, -1)

	if detail.RequestBody != "a..." {
		t.Fatalf("expected request body to be truncated to a..., got %q", detail.RequestBody)
	}

	if !detail.RequestBodyTruncated {
		t.Fatal("expected request body truncated flag to be true")
	}

	if detail.ResponseBody != "" {
		t.Fatalf("expected response body to be cleared, got %q", detail.ResponseBody)
	}

	if !detail.ResponseBodyTruncated {
		t.Fatal("expected response body truncated flag to be true")
	}
}

func TestGetLogStatsAggregatesFilteredLogs(t *testing.T) {
	withTestLogStatsDB(t, func() {
		now := time.Date(2026, 4, 29, 12, 0, 0, 0, time.Local)
		require.NoError(t, model.DB.Create(&model.AppUser{
			Email:        model.EmptyNullString("stats@example.com"),
			PasswordHash: "hashed-password",
			Status:       model.AppUserStatusEnabled,
		}).Error)

		user := &model.AppUser{}
		require.NoError(t, model.DB.Where("email = ?", "stats@example.com").First(user).Error)

		require.NoError(t, model.LogDB.Create(&model.Log{
			CreatedAt:   now,
			RequestAt:   now.Add(-2 * time.Second),
			GroupID:     "g1",
			Model:       "gpt-4.1",
			TokenName:   "key-a",
			OwnerUserID: user.ID,
			User:        model.EmptyNullString("stats@example.com"),
			Code:        200,
			Usage: model.Usage{
				InputTokens:  100,
				OutputTokens: 40,
				TotalTokens:  140,
			},
			Amount: model.Amount{UsedAmount: 0.12},
		}).Error)
		require.NoError(t, model.LogDB.Create(&model.Log{
			CreatedAt:   now.Add(time.Minute),
			RequestAt:   now.Add(time.Minute).Add(-1 * time.Second),
			GroupID:     "g1",
			Model:       "gpt-4.1",
			TokenName:   "key-a",
			OwnerUserID: user.ID,
			User:        model.EmptyNullString("stats@example.com"),
			Code:        500,
			Usage: model.Usage{
				InputTokens:  30,
				OutputTokens: 10,
				TotalTokens:  40,
			},
			Amount: model.Amount{UsedAmount: 0.03},
		}).Error)

		stats, err := model.GetLogStats(
			"",
			"",
			"",
			"g1",
			0,
			"",
			"gpt-4.1",
			now.Add(-time.Hour),
			now.Add(time.Hour),
			0,
			model.CodeType(""),
			0,
			"",
			"stats@example.com",
		)
		require.NoError(t, err)
		require.EqualValues(t, 2, stats.TotalCount)
		require.EqualValues(t, 1, stats.SuccessCount)
		require.EqualValues(t, 1, stats.ErrorCount)
		require.Equal(t, 0.15, stats.UsedAmount)
		require.EqualValues(t, 130, stats.InputTokens)
		require.EqualValues(t, 50, stats.OutputTokens)
		require.EqualValues(t, 180, stats.TotalTokens)
		require.InDelta(t, 1500, stats.AverageMilliseconds, 1)
	})
}

func TestRequestDetailApplyBodySizeLimitsZeroKeepsOriginalBody(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody:  "abcdef",
		ResponseBody: "你好世界",
	}

	detail.ApplyBodySizeLimits(0, 0)

	if detail.RequestBody != "abcdef" {
		t.Fatalf("expected request body to remain unchanged, got %q", detail.RequestBody)
	}

	if detail.RequestBodyTruncated {
		t.Fatal("expected request body truncated flag to remain false")
	}

	if detail.ResponseBody != "你好世界" {
		t.Fatalf("expected response body to remain unchanged, got %q", detail.ResponseBody)
	}

	if detail.ResponseBodyTruncated {
		t.Fatal("expected response body truncated flag to remain false")
	}
}

func withTestLogStatsDB(t *testing.T, fn func()) {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LogDB
	oldUsingSQLite := common.UsingSQLite

	db, err := model.OpenSQLite(filepath.Join(t.TempDir(), "log_stats_test.db"))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.AppUser{},
		&model.Log{},
		&model.RequestDetail{},
	))

	model.DB = db
	model.LogDB = db
	common.UsingSQLite = true

	t.Cleanup(func() {
		model.DB = oldDB
		model.LogDB = oldLogDB
		common.UsingSQLite = oldUsingSQLite

		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})

	fn()
}

func TestRequestDetailApplyBodySizeLimitsSanitizesRequestMessages(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody: `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}],"nested":{"message":"secret","keep":"ok"}}`,
	}

	detail.ApplyBodySizeLimits(0, 0)

	var actual map[string]any
	if err := sonic.UnmarshalString(detail.RequestBody, &actual); err != nil {
		t.Fatalf("expected sanitized request body to be valid json: %v", err)
	}

	if _, ok := actual["messages"]; ok {
		t.Fatal("expected top-level messages field to be removed")
	}

	nested, ok := actual["nested"].(map[string]any)
	if !ok {
		t.Fatalf("expected nested field to remain object, got %#v", actual["nested"])
	}

	if _, ok := nested["message"]; ok {
		t.Fatal("expected nested message field to be removed")
	}

	if nested["keep"] != "ok" {
		t.Fatalf("expected nested keep field to remain, got %#v", nested["keep"])
	}

	if actual["model"] != "gpt-4o" {
		t.Fatalf("expected model field to remain, got %#v", actual["model"])
	}
}

func TestRequestDetailApplyBodySizeLimitsLeavesInvalidJSONRequestBodyUntouched(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody: `{"messages":[`,
	}

	detail.ApplyBodySizeLimits(0, 0)

	if detail.RequestBody != `{"messages":[` {
		t.Fatalf("expected invalid json request body to remain unchanged, got %q", detail.RequestBody)
	}
}

func TestRequestDetailApplyBodySizeLimitsSanitizesResponseBody(t *testing.T) {
	detail := &model.RequestDetail{
		ResponseBody: `{"type":"error","error":{"message":"request timeout: Post \"https://newnei.apifast.top/v1/messages\": dial tcp 203.0.113.10:443: http2: timeout awaiting response headers"}}`,
	}

	detail.ApplyBodySizeLimits(0, 0)

	if strings.Contains(detail.ResponseBody, "newnei.apifast.top") {
		t.Fatalf("expected response body URL to be redacted, got %q", detail.ResponseBody)
	}

	if strings.Contains(detail.ResponseBody, "203.0.113.10") {
		t.Fatalf("expected response body IP to be redacted, got %q", detail.ResponseBody)
	}

	if !strings.Contains(detail.ResponseBody, "[redacted_url]") {
		t.Fatalf("expected response body to contain redacted URL marker, got %q", detail.ResponseBody)
	}

	if !strings.Contains(detail.ResponseBody, "[redacted_ip]") {
		t.Fatalf("expected response body to contain redacted IP marker, got %q", detail.ResponseBody)
	}

	var payload any
	if err := sonic.UnmarshalString(detail.ResponseBody, &payload); err != nil {
		t.Fatalf("expected sanitized response body to remain valid json: %v", err)
	}
}
