package mode_test

import (
	"testing"

	"github.com/labring/aiproxy/core/relay/mode"
	"github.com/stretchr/testify/assert"
)

func TestModeCompatibility(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		requestMode mode.Mode
		modelMode   mode.Mode
		want        bool
	}{
		{
			name:        "chat completions can use gemini model capability",
			requestMode: mode.ChatCompletions,
			modelMode:   mode.Gemini,
			want:        true,
		},
		{
			name:        "gemini request can use anthropic model capability",
			requestMode: mode.Gemini,
			modelMode:   mode.Anthropic,
			want:        true,
		},
		{
			name:        "anthropic request can use responses model capability",
			requestMode: mode.Anthropic,
			modelMode:   mode.Responses,
			want:        true,
		},
		{
			name:        "unknown model capability accepts request mode",
			requestMode: mode.Embeddings,
			modelMode:   mode.Unknown,
			want:        true,
		},
		{
			name:        "chat request cannot use image model capability",
			requestMode: mode.ChatCompletions,
			modelMode:   mode.ImagesGenerations,
			want:        false,
		},
		{
			name:        "image generation can use image edit capability",
			requestMode: mode.ImagesGenerations,
			modelMode:   mode.ImagesEdits,
			want:        true,
		},
		{
			name:        "video get job can use video generation capability",
			requestMode: mode.VideoGenerationsGetJobs,
			modelMode:   mode.VideoGenerationsJobs,
			want:        true,
		},
		{
			name:        "embedding still requires exact capability",
			requestMode: mode.Embeddings,
			modelMode:   mode.Rerank,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			assert.Equal(t, tt.want, tt.modelMode.IsCompatibleWith(tt.requestMode))
		})
	}
}

func TestModeSupportsStreamTimeout(t *testing.T) {
	t.Parallel()

	assert.True(t, mode.ChatCompletions.SupportsStreamTimeout())
	assert.True(t, mode.Anthropic.SupportsStreamTimeout())
	assert.True(t, mode.Gemini.SupportsStreamTimeout())
	assert.True(t, mode.Responses.SupportsStreamTimeout())

	assert.False(t, mode.ResponsesGet.SupportsStreamTimeout())
	assert.False(t, mode.ImagesGenerations.SupportsStreamTimeout())
}
