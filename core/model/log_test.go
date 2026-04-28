package model_test

import (
	"strings"
	"testing"

	"github.com/bytedance/sonic"
	"github.com/labring/aiproxy/core/model"
)

func TestRequestDetailApplyBodySizeLimits(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody:  "abcdef",
		ResponseBody: "uvwxyz",
	}

	detail.ApplyBodySizeLimits(4, -1)

	if detail.RequestBody != "a..." {
		t.Fatalf("expected request body to be truncated to a..., got %q", detail.RequestBody)
	}

	if !detail.RequestBodyTruncated {
		t.Fatal("expected request body truncated flag to be true")
	}

	if detail.ResponseBody != "" {
		t.Fatalf("expected response body to be cleared, got %q", detail.ResponseBody)
	}

	if !detail.ResponseBodyTruncated {
		t.Fatal("expected response body truncated flag to be true")
	}
}

func TestRequestDetailApplyBodySizeLimitsZeroKeepsOriginalBody(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody:  "abcdef",
		ResponseBody: "你好世界",
	}

	detail.ApplyBodySizeLimits(0, 0)

	if detail.RequestBody != "abcdef" {
		t.Fatalf("expected request body to remain unchanged, got %q", detail.RequestBody)
	}

	if detail.RequestBodyTruncated {
		t.Fatal("expected request body truncated flag to remain false")
	}

	if detail.ResponseBody != "你好世界" {
		t.Fatalf("expected response body to remain unchanged, got %q", detail.ResponseBody)
	}

	if detail.ResponseBodyTruncated {
		t.Fatal("expected response body truncated flag to remain false")
	}
}

func TestRequestDetailApplyBodySizeLimitsSanitizesRequestMessages(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody: `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}],"nested":{"message":"secret","keep":"ok"}}`,
	}

	detail.ApplyBodySizeLimits(0, 0)

	var actual map[string]any
	if err := sonic.UnmarshalString(detail.RequestBody, &actual); err != nil {
		t.Fatalf("expected sanitized request body to be valid json: %v", err)
	}

	if _, ok := actual["messages"]; ok {
		t.Fatal("expected top-level messages field to be removed")
	}

	nested, ok := actual["nested"].(map[string]any)
	if !ok {
		t.Fatalf("expected nested field to remain object, got %#v", actual["nested"])
	}

	if _, ok := nested["message"]; ok {
		t.Fatal("expected nested message field to be removed")
	}

	if nested["keep"] != "ok" {
		t.Fatalf("expected nested keep field to remain, got %#v", nested["keep"])
	}

	if actual["model"] != "gpt-4o" {
		t.Fatalf("expected model field to remain, got %#v", actual["model"])
	}
}

func TestRequestDetailApplyBodySizeLimitsLeavesInvalidJSONRequestBodyUntouched(t *testing.T) {
	detail := &model.RequestDetail{
		RequestBody: `{"messages":[`,
	}

	detail.ApplyBodySizeLimits(0, 0)

	if detail.RequestBody != `{"messages":[` {
		t.Fatalf("expected invalid json request body to remain unchanged, got %q", detail.RequestBody)
	}
}

func TestRequestDetailApplyBodySizeLimitsSanitizesResponseBody(t *testing.T) {
	detail := &model.RequestDetail{
		ResponseBody: `{"type":"error","error":{"message":"request timeout: Post \"https://newnei.apifast.top/v1/messages\": dial tcp 203.0.113.10:443: http2: timeout awaiting response headers"}}`,
	}

	detail.ApplyBodySizeLimits(0, 0)

	if strings.Contains(detail.ResponseBody, "newnei.apifast.top") {
		t.Fatalf("expected response body URL to be redacted, got %q", detail.ResponseBody)
	}

	if strings.Contains(detail.ResponseBody, "203.0.113.10") {
		t.Fatalf("expected response body IP to be redacted, got %q", detail.ResponseBody)
	}

	if !strings.Contains(detail.ResponseBody, "[redacted_url]") {
		t.Fatalf("expected response body to contain redacted URL marker, got %q", detail.ResponseBody)
	}

	if !strings.Contains(detail.ResponseBody, "[redacted_ip]") {
		t.Fatalf("expected response body to contain redacted IP marker, got %q", detail.ResponseBody)
	}

	var payload any
	if err := sonic.UnmarshalString(detail.ResponseBody, &payload); err != nil {
		t.Fatalf("expected sanitized response body to remain valid json: %v", err)
	}
}
