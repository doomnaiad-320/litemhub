package consume

import (
	"testing"

	"github.com/labring/aiproxy/core/model"
)

func TestWithConditionalPriceMetadata(t *testing.T) {
	metadata := withConditionalPriceMetadata(nil, model.SelectedConditionalPrice{
		Index:   1,
		Matched: true,
		Condition: model.PriceCondition{
			InputTokenMin:  1000001,
			OutputTokenMax: 2000,
			ServiceTier:    "priority",
		},
	})

	expected := map[string]string{
		"price_source":                     "conditional_prices",
		"price_condition_index":            "1",
		"price_condition_number":           "2",
		"price_condition_input_token_min":  "1000001",
		"price_condition_output_token_max": "2000",
		"price_condition_service_tier":     "priority",
	}
	for key, want := range expected {
		if got := metadata[key]; got != want {
			t.Fatalf("expected metadata %s=%q, got %q", key, want, got)
		}
	}
}

func TestWithConditionalPriceMetadataNoMatch(t *testing.T) {
	metadata := map[string]string{"existing": "value"}

	got := withConditionalPriceMetadata(metadata, model.SelectedConditionalPrice{Index: -1})
	if got["existing"] != "value" {
		t.Fatalf("expected existing metadata to remain, got %#v", got)
	}
	if _, ok := got["price_source"]; ok {
		t.Fatalf("expected no price metadata when condition is not matched, got %#v", got)
	}
}
