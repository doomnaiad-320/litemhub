package model

import (
	"testing"

	"github.com/bytedance/sonic"
	"github.com/labring/aiproxy/core/relay/mode"
	"github.com/stretchr/testify/require"
)

func TestSanitizeErrorMessageRedactsURLAndIP(t *testing.T) {
	message := `request timeout: Post "https://newnei.apifast.top/v1/messages": dial tcp 203.0.113.10:443: http2: timeout awaiting response headers`

	sanitized := SanitizeErrorMessage(message)

	require.Equal(
		t,
		`request timeout: Post "[redacted_url]": dial tcp [redacted_ip]:443: http2: timeout awaiting response headers`,
		sanitized,
	)
	require.NotContains(t, sanitized, "newnei.apifast.top")
	require.NotContains(t, sanitized, "203.0.113.10")
}

func TestSanitizeErrorMessageRedactsIPv6(t *testing.T) {
	message := `dial tcp [2001:db8::1]:443: connect: no route to host`

	sanitized := SanitizeErrorMessage(message)

	require.Equal(t, `dial tcp [redacted_ip]:443: connect: no route to host`, sanitized)
	require.NotContains(t, sanitized, "2001:db8::1")
}

func TestSanitizeErrorMessageKeepsNonIPNumbers(t *testing.T) {
	message := `bad response status code 503 after 10.20 seconds`

	sanitized := SanitizeErrorMessage(message)

	require.Equal(t, message, sanitized)
}

func TestWrapperErrorWithMessageRedactsPublicErrorMessage(t *testing.T) {
	err := WrapperErrorWithMessage(
		mode.Anthropic,
		408,
		`request timeout: Post "https://newnei.apifast.top/v1/messages": http2: timeout awaiting response headers`,
	)

	data, marshalErr := err.MarshalJSON()
	require.NoError(t, marshalErr)

	var body AnthropicErrorResponse
	require.NoError(t, sonic.Unmarshal(data, &body))
	require.Equal(
		t,
		`request timeout: Post "[redacted_url]": http2: timeout awaiting response headers`,
		body.Error.Message,
	)
	require.NotContains(t, body.Error.Message, "newnei.apifast.top")
}
