//nolint:testpackage
package openai

import (
	"testing"

	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/meta"
	"github.com/stretchr/testify/assert"
)

func TestShouldUseChatCompletionsStreamFastPathRequiresModelOptIn(t *testing.T) {
	assert.False(t, shouldUseChatCompletionsStreamFastPath(
		&meta.Meta{},
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
}
