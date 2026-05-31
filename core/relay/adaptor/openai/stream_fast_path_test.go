package openai_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/adaptor/openai"
	"github.com/labring/aiproxy/core/relay/meta"
	relaymodel "github.com/labring/aiproxy/core/relay/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsStreamFastPathHandlerRedactsModelAndKeepsContent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := bytes.NewBufferString(
		"data: {\"id\":\"chatcmpl-upstream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"upstream-model\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"}}]}\n\n" +
			"data: {\"id\":\"chatcmpl-upstream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"upstream-model\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\" world\"},\"finish_reason\":\"stop\"}]}\n\n" +
			"data: {\"id\":\"chatcmpl-upstream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"upstream-model\",\"choices\":[],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5}}\n\n" +
			"data: [DONE]\n\n",
	)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/v1/chat/completions", nil)

	result, err := openai.ChatCompletionsStreamFastPathHandler(
		&meta.Meta{
			OriginModel:  "public-model",
			ActualModel:  "upstream-model",
			RequestUsage: model.Usage{InputTokens: 3},
		},
		c,
		&http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
			Body:       &mockReadCloser{Reader: bytes.NewReader(body.Bytes())},
		},
	)
	require.Nil(t, err)

	events := parseOpenAISSEEvents(t, recorder.Body.Bytes())
	require.Len(t, events, 4)

	var first relaymodel.ChatCompletionsStreamResponse
	require.NoError(t, json.Unmarshal(events[0], &first))
	assert.Equal(t, "public-model", first.Model)
	assert.Equal(t, "hello", first.Choices[0].Delta.Content)

	var second relaymodel.ChatCompletionsStreamResponse
	require.NoError(t, json.Unmarshal(events[1], &second))
	assert.Equal(t, "public-model", second.Model)
	assert.Equal(t, " world", second.Choices[0].Delta.Content)
	assert.Equal(t, relaymodel.FinishReasonStop, second.Choices[0].FinishReason)

	assert.Equal(t, int64(3), int64(result.Usage.InputTokens))
	assert.Equal(t, int64(2), int64(result.Usage.OutputTokens))
	assert.Equal(t, int64(5), int64(result.Usage.TotalTokens))
	assert.Equal(t, "chatcmpl-upstream", result.UpstreamID)
	assert.Equal(t, []byte("[DONE]"), events[3])
	assert.NotContains(t, recorder.Body.String(), "upstream-model")
}

func TestChatCompletionsStreamFastPathHandlerEstimatesUsageWhenUpstreamUsageMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := bytes.NewBufferString(
		"data: {\"id\":\"chatcmpl-upstream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"upstream-model\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello world\"}}]}\n\n" +
			"data: [DONE]\n\n",
	)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/v1/chat/completions", nil)

	result, err := openai.ChatCompletionsStreamFastPathHandler(
		&meta.Meta{
			OriginModel:  "public-model",
			ActualModel:  "upstream-model",
			RequestUsage: model.Usage{InputTokens: 7},
		},
		c,
		&http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
			Body:       &mockReadCloser{Reader: bytes.NewReader(body.Bytes())},
		},
	)
	require.Nil(t, err)

	assert.Equal(t, int64(7), int64(result.Usage.InputTokens))
	assert.Greater(t, int64(result.Usage.OutputTokens), int64(0))
	assert.Greater(t, int64(result.Usage.TotalTokens), int64(result.Usage.InputTokens))

	events := parseOpenAISSEEvents(t, recorder.Body.Bytes())
	require.Len(t, events, 3)

	var usageChunk relaymodel.ChatCompletionsStreamResponse
	require.NoError(t, json.Unmarshal(events[1], &usageChunk))
	require.NotNil(t, usageChunk.Usage)
	assert.Equal(t, "public-model", usageChunk.Model)
}

func parseOpenAISSEEvents(t *testing.T, body []byte) [][]byte {
	t.Helper()

	parts := bytes.Split(body, []byte("\n\n"))
	events := make([][]byte, 0, len(parts))
	for _, part := range parts {
		part = bytes.TrimSpace(part)
		if len(part) == 0 {
			continue
		}

		require.True(t, bytes.HasPrefix(part, []byte("data: ")), string(part))
		events = append(events, bytes.TrimSpace(bytes.TrimPrefix(part, []byte("data: "))))
	}

	return events
}
