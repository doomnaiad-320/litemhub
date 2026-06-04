package middleware_test

import (
	"testing"

	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/relay/mode"
	"github.com/stretchr/testify/assert"
)

func TestCheckRelayModeUsesCapabilityGroups(t *testing.T) {
	t.Parallel()

	assert.True(t, middleware.CheckRelayMode(mode.ChatCompletions, mode.Gemini))
	assert.True(t, middleware.CheckRelayMode(mode.Gemini, mode.ChatCompletions))
	assert.True(t, middleware.CheckRelayMode(mode.Anthropic, mode.Responses))
	assert.True(t, middleware.CheckRelayMode(mode.ImagesGenerations, mode.ImagesEdits))
	assert.True(t, middleware.CheckRelayMode(mode.VideoGenerationsContent, mode.VideoGenerationsJobs))

	assert.False(t, middleware.CheckRelayMode(mode.ChatCompletions, mode.ImagesGenerations))
	assert.False(t, middleware.CheckRelayMode(mode.Embeddings, mode.Rerank))
}
