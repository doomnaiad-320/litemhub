package controller

import (
	"strings"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
)

func TestUserTokenResponseJSONOmitsOwnerUserID(t *testing.T) {
	token := &UserTokenResponse{
		CreatedAt: time.Unix(1, 0),
		Key:       strings.Repeat("a", 48),
		Name:      model.EmptyNullString("user-key"),
		GroupID:   "default",
		Models:    []string{"gpt-test"},
		Status:    model.TokenStatusEnabled,
		ID:        123,
		Quota:     10,
	}

	payload, err := sonic.Marshal(token)
	require.NoError(t, err)

	body := string(payload)
	require.NotContains(t, body, "owner_user_id")
	require.Contains(t, body, `"id":123`)
	require.Contains(t, body, `"group":"default"`)
}
