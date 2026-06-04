package cache

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/adaptor"
	"github.com/labring/aiproxy/core/relay/meta"
	"github.com/labring/aiproxy/core/relay/mode"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type convertRequestFunc struct {
	calls int
	fn    func(*meta.Meta, adaptor.Store, *http.Request) (adaptor.ConvertResult, error)
}

func (f *convertRequestFunc) ConvertRequest(
	meta *meta.Meta,
	store adaptor.Store,
	req *http.Request,
) (adaptor.ConvertResult, error) {
	f.calls++

	return f.fn(meta, store, req)
}

type doResponseFunc struct {
	calls int
	fn    func(*meta.Meta, adaptor.Store, *gin.Context, *http.Response) (adaptor.DoResponseResult, adaptor.Error)
}

func (f *doResponseFunc) DoResponse(
	meta *meta.Meta,
	store adaptor.Store,
	c *gin.Context,
	resp *http.Response,
) (adaptor.DoResponseResult, adaptor.Error) {
	f.calls++

	return f.fn(meta, store, c, resp)
}

func cacheTestMeta(requestMode mode.Mode) *meta.Meta {
	return meta.NewMeta(
		nil,
		requestMode,
		"cache-test-model",
		model.ModelConfig{
			Model: "cache-test-model",
			Plugin: map[string]map[string]any{
				"cache": {
					"enable":               true,
					"ttl":                  60,
					"add_cache_hit_header": true,
				},
			},
		},
	)
}

func TestCacheBypassesChatLikeFullResponseCache(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	requestMeta := cacheTestMeta(mode.ChatCompletions)
	plugin := &Cache{}
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"same"}]}`

	convert := &convertRequestFunc{
		fn: func(
			*meta.Meta,
			adaptor.Store,
			*http.Request,
		) (adaptor.ConvertResult, error) {
			return adaptor.ConvertResult{Body: strings.NewReader(body)}, nil
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	_, err := plugin.ConvertRequest(requestMeta, nil, req, convert)
	require.NoError(t, err)
	assert.Equal(t, 1, convert.calls)
	assert.Empty(t, getCacheKey(requestMeta))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	doResp := &doResponseFunc{
		fn: func(
			*meta.Meta,
			adaptor.Store,
			*gin.Context,
			*http.Response,
		) (adaptor.DoResponseResult, adaptor.Error) {
			_, _ = ctx.Writer.WriteString(`{"id":"first"}`)
			return adaptor.DoResponseResult{}, nil
		},
	}

	_, relayErr := plugin.DoResponse(
		requestMeta,
		nil,
		ctx,
		&http.Response{StatusCode: http.StatusOK},
		doResp,
	)
	require.NoError(t, relayErr)
	assert.Equal(t, 1, doResp.calls)
	assert.Empty(t, recorder.Header().Get(cacheHeader))
}

func TestCacheKeepsFullResponseCacheForNonChatModes(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	plugin := &Cache{}
	body := `{"model":"image-model","prompt":"same"}`

	firstMeta := cacheTestMeta(mode.ImagesGenerations)
	firstReq := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
	firstConvert := &convertRequestFunc{
		fn: func(
			*meta.Meta,
			adaptor.Store,
			*http.Request,
		) (adaptor.ConvertResult, error) {
			return adaptor.ConvertResult{Body: strings.NewReader(body)}, nil
		},
	}

	_, err := plugin.ConvertRequest(firstMeta, nil, firstReq, firstConvert)
	require.NoError(t, err)
	require.NotEmpty(t, getCacheKey(firstMeta))
	assert.False(t, isCacheHit(firstMeta))

	firstRecorder := httptest.NewRecorder()
	firstCtx, _ := gin.CreateTestContext(firstRecorder)
	firstCtx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	firstDoResp := &doResponseFunc{
		fn: func(
			*meta.Meta,
			adaptor.Store,
			*gin.Context,
			*http.Response,
		) (adaptor.DoResponseResult, adaptor.Error) {
			firstCtx.Header("Content-Type", "application/json")
			_, _ = firstCtx.Writer.WriteString(`{"id":"cached"}`)
			return adaptor.DoResponseResult{}, nil
		},
	}

	_, relayErr := plugin.DoResponse(
		firstMeta,
		nil,
		firstCtx,
		&http.Response{StatusCode: http.StatusOK},
		firstDoResp,
	)
	require.NoError(t, relayErr)
	assert.Equal(t, "miss", firstRecorder.Header().Get(cacheHeader))

	secondMeta := cacheTestMeta(mode.ImagesGenerations)
	secondReq := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
	secondConvert := &convertRequestFunc{
		fn: func(
			*meta.Meta,
			adaptor.Store,
			*http.Request,
		) (adaptor.ConvertResult, error) {
			t.Fatal("convert should not be called on cache hit")
			return adaptor.ConvertResult{}, nil
		},
	}

	_, err = plugin.ConvertRequest(secondMeta, nil, secondReq, secondConvert)
	require.NoError(t, err)
	require.True(t, isCacheHit(secondMeta))

	secondRecorder := httptest.NewRecorder()
	secondCtx, _ := gin.CreateTestContext(secondRecorder)
	secondCtx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	secondDoResp := &doResponseFunc{
		fn: func(
			*meta.Meta,
			adaptor.Store,
			*gin.Context,
			*http.Response,
		) (adaptor.DoResponseResult, adaptor.Error) {
			t.Fatal("do response should not be called on cache hit")
			return adaptor.DoResponseResult{}, nil
		},
	}

	_, relayErr = plugin.DoResponse(
		secondMeta,
		nil,
		secondCtx,
		&http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(""))},
		secondDoResp,
	)
	require.NoError(t, relayErr)
	assert.Equal(t, "hit", secondRecorder.Header().Get(cacheHeader))
	assert.Equal(t, `{"id":"cached"}`, secondRecorder.Body.String())
}
