//nolint:testpackage
package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetResponsesRequestUsage(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"/v1/responses",
		bytes.NewBufferString(`{
			"model":"gpt-5",
			"instructions":"Be concise.",
			"input":[
				{"role":"user","content":[{"type":"input_text","text":"Explain wallet billing."}]}
			]
		}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	usage, err := GetResponsesRequestUsage(c, model.ModelConfig{})
	require.NoError(t, err)
	assert.Positive(t, int64(usage.InputTokens))
}
