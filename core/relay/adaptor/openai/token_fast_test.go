package openai_test

import (
	"testing"

	"github.com/labring/aiproxy/core/relay/adaptor/openai"
	relaymodel "github.com/labring/aiproxy/core/relay/model"
	"github.com/stretchr/testify/assert"
)

func TestCountTokenMessagesWithThresholdUsesEstimateAboveThreshold(t *testing.T) {
	messages := []relaymodel.Message{
		{Role: relaymodel.RoleUser, Content: "abcdefghijklmnop"},
	}

	usage := openai.CountTokenMessagesWithThreshold(messages, "gpt-4o", false, 1)

	assert.Equal(t, int64(11), usage)
}

func TestCountTokenMessagesWithThresholdCanDisablePreciseCount(t *testing.T) {
	messages := []relaymodel.Message{
		{Role: relaymodel.RoleUser, Content: "abc"},
	}

	usage := openai.CountTokenMessagesWithThreshold(messages, "gpt-4o", false, -1)

	assert.Equal(t, int64(7), usage)
}
