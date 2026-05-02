//nolint:testpackage
package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/model"
	"github.com/stretchr/testify/assert"
)

func TestRetryStateRemainingRelayDelay(t *testing.T) {
	t.Parallel()

	t.Run("uses per-channel failure count plus jitter", func(t *testing.T) {
		t.Parallel()

		state := &retryState{}
		base := time.Unix(100, 0)
		jitter := 400 * time.Millisecond

		state.recordChannelFailure(7, base)

		assert.Equal(t, 1400*time.Millisecond, state.remainingRelayDelay(7, base, jitter))
		assert.Equal(
			t,
			900*time.Millisecond,
			state.remainingRelayDelay(7, base.Add(500*time.Millisecond), jitter),
		)

		state.recordChannelFailure(7, base.Add(2*time.Second))

		assert.Equal(
			t,
			2400*time.Millisecond,
			state.remainingRelayDelay(7, base.Add(2*time.Second), jitter),
		)
		assert.Equal(
			t,
			1150*time.Millisecond,
			state.remainingRelayDelay(7, base.Add(3250*time.Millisecond), jitter),
		)
	})

	t.Run("returns zero after required wait has already elapsed", func(t *testing.T) {
		t.Parallel()

		state := &retryState{}
		base := time.Unix(200, 0)

		state.recordChannelFailure(9, base)

		assert.Zero(
			t,
			state.remainingRelayDelay(9, base.Add(1500*time.Millisecond), 400*time.Millisecond),
		)
		assert.Zero(t, state.remainingRelayDelay(9, base.Add(2*time.Second), 400*time.Millisecond))
	})

	t.Run("tracks each channel independently", func(t *testing.T) {
		t.Parallel()

		state := &retryState{}
		base := time.Unix(300, 0)

		state.recordChannelFailure(1, base)
		state.recordChannelFailure(2, base)
		state.recordChannelFailure(2, base.Add(100*time.Millisecond))

		assert.Equal(
			t,
			500*time.Millisecond,
			state.remainingRelayDelay(1, base.Add(800*time.Millisecond), 300*time.Millisecond),
		)
		assert.Equal(
			t,
			1500*time.Millisecond,
			state.remainingRelayDelay(2, base.Add(900*time.Millisecond), 300*time.Millisecond),
		)
		assert.Zero(t, state.remainingRelayDelay(3, base, 300*time.Millisecond))
	})

	t.Run("caps backoff at five seconds", func(t *testing.T) {
		t.Parallel()

		base := time.Unix(400, 0)
		state := &retryState{}

		for range 20 {
			state.recordChannelFailure(5, base)
		}

		assert.Equal(t, 5*time.Second, state.remainingRelayDelay(5, base, time.Second))
		assert.Zero(t, state.remainingRelayDelay(5, base.Add(5*time.Second), time.Second))
	})
}

func TestCalculateRelayBackoffDelay(t *testing.T) {
	t.Parallel()

	assert.Zero(t, calculateRelayBackoffDelay(0, 500*time.Millisecond))
	assert.Equal(t, 1500*time.Millisecond, calculateRelayBackoffDelay(1, 500*time.Millisecond))
	assert.Equal(t, 2500*time.Millisecond, calculateRelayBackoffDelay(2, 500*time.Millisecond))
	assert.Equal(t, 5*time.Second, calculateRelayBackoffDelay(20, time.Second))
	assert.Equal(t, 2*time.Second, calculateRelayBackoffDelay(1, time.Second))
}

func TestGetReserveOutputTokens(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	newContext := func(body string) *gin.Context {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequestWithContext(
			t.Context(),
			http.MethodPost,
			"/v1/responses",
			bytes.NewBufferString(body),
		)
		c.Request.Header.Set("Content-Type", "application/json")

		return c
	}

	t.Run("uses explicit request output limit first", func(t *testing.T) {
		t.Parallel()

		outputTokens := getReserveOutputTokens(
			newContext(`{"max_output_tokens":123}`),
			model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigMaxOutputTokensKey:  4096,
					model.ModelConfigMaxContextTokensKey: 200000,
				},
			},
			model.Usage{},
		)

		assert.Equal(t, int64(123), outputTokens)
	})

	t.Run("uses configured max output tokens", func(t *testing.T) {
		t.Parallel()

		outputTokens := getReserveOutputTokens(
			newContext(`{}`),
			model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigMaxOutputTokensKey:  4096,
					model.ModelConfigMaxContextTokensKey: 200000,
				},
			},
			model.Usage{},
		)

		assert.Equal(t, int64(4096), outputTokens)
	})

	t.Run("does not treat context window as output budget", func(t *testing.T) {
		t.Parallel()

		outputTokens := getReserveOutputTokens(
			newContext(`{}`),
			model.ModelConfig{
				Config: map[model.ModelConfigKey]any{
					model.ModelConfigMaxContextTokensKey: 200000,
				},
			},
			model.Usage{InputTokens: model.ZeroNullInt64(1000)},
		)

		assert.Zero(t, outputTokens)
	})
}
