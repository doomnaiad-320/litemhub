//nolint:testpackage
package controller

import (
	"encoding/json"
	"testing"

	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/require"
)

func TestPublicModelHealthIsAbsentWithoutHistory(t *testing.T) {
	response := &PublicModelResponse{}

	response.addGroupHealth("default", model.GroupModelHealthMetric{})

	require.Nil(t, response.Health)
	require.Empty(t, response.GroupHealth)
}

func TestPublicModelHealthKeepsZeroPercentWithHistory(t *testing.T) {
	response := &PublicModelResponse{}

	response.addGroupHealth("default", model.GroupModelHealthMetric{
		GroupID:       "default",
		Model:         "gpt-test",
		RequestCount:  3,
		SuccessCount:  0,
		ErrorCount:    3,
		SuccessRate:   0,
		HealthPercent: 0,
	})

	require.NotNil(t, response.Health)
	require.Equal(t, int64(3), response.Health.RequestCount)
	require.Equal(t, 0, response.Health.HealthPercent)

	payload, err := json.Marshal(response.Health)
	require.NoError(t, err)
	require.JSONEq(t, `{
		"request_count": 3,
		"success_count": 0,
		"error_count": 3,
		"success_rate": 0,
		"health_percent": 0
	}`, string(payload))
}
