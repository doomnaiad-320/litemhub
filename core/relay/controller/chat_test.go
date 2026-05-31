package controller

import (
	"testing"

	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/assert"
)

func TestModelTokenCountThreshold(t *testing.T) {
	assert.Equal(t, int64(0), modelTokenCountThreshold(model.ModelConfig{}))

	assert.Equal(t, int64(123), modelTokenCountThreshold(model.ModelConfig{
		Config: map[model.ModelConfigKey]any{
			model.ModelConfigFuzzyTokenThresholdKey: 123,
		},
	}))

	assert.Equal(t, int64(0), modelTokenCountThreshold(model.ModelConfig{
		Config: map[model.ModelConfigKey]any{
			model.ModelConfigFuzzyTokenThresholdKey: -1,
		},
	}))

	assert.Equal(t, int64(-1), modelTokenCountThreshold(model.ModelConfig{
		Config: map[model.ModelConfigKey]any{
			model.ModelConfigFuzzyTokenThresholdKey:      123,
			model.ModelConfigDisablePreciseTokenCountKey: true,
		},
	}))
}
