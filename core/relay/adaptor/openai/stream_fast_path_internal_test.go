//nolint:testpackage
package openai

import (
	"testing"

	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/meta"
	"github.com/stretchr/testify/assert"
)

func TestShouldUseChatCompletionsStreamFastPathPolicy(t *testing.T) {
	assert.True(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{},
		nil,
	))

	assert.False(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{
			ModelConfig: model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigChatCompletionsStreamFastPathKey: "off",
				},
			},
		},
		nil,
	))

	assert.True(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{
			ModelConfig: model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigChatCompletionsStreamFastPathKey: "auto",
				},
			},
		},
		nil,
	))

	assert.True(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{
			ModelConfig: model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigChatCompletionsStreamFastPathKey: "on",
				},
			},
		},
		nil,
	))

	assert.True(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{
			ModelConfig: model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigChatCompletionsStreamFastPathKey: true,
				},
			},
		},
		nil,
	))

	assert.False(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{
			ModelConfig: model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigChatCompletionsStreamFastPathKey: false,
				},
			},
		},
		nil,
	))
}
