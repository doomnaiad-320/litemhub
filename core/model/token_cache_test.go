package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTokenCacheFindModelRespectsAvailableSets(t *testing.T) {
	t.Parallel()

	modelsBySet := map[string][]string{
		"provider-a": {"claude-opus-4-7-thinking"},
		"provider-b": {"gpt-5"},
	}

	token := TokenCache{
		Models: []string{"claude-opus-4-7-thinking"},
	}
	token.SetAvailableSets([]string{"provider-b"})
	token.SetModelsBySet(modelsBySet)

	assert.Empty(t, token.FindModel("claude-opus-4-7-thinking"))
}

func TestTokenCacheFindModelAllowsSameModelInsideAvailableSet(t *testing.T) {
	t.Parallel()

	modelsBySet := map[string][]string{
		"provider-a": {"claude-opus-4-7-thinking"},
		"provider-b": {"claude-opus-4-7-thinking"},
	}

	token := TokenCache{
		Models: []string{"CLAUDE-OPUS-4-7-THINKING"},
	}
	token.SetAvailableSets([]string{"provider-b"})
	token.SetModelsBySet(modelsBySet)

	assert.Equal(t, "claude-opus-4-7-thinking", token.FindModel("claude-opus-4-7-thinking"))
}

func TestGroupCacheGetAvailableSetsFallsBackToGroupID(t *testing.T) {
	t.Parallel()

	group := GroupCache{ID: "provider-a"}

	assert.Equal(t, []string{"provider-a"}, group.GetAvailableSets())
}

func TestGroupCacheGetAvailableSetsUsesExplicitSets(t *testing.T) {
	t.Parallel()

	group := GroupCache{
		ID:            "provider-a",
		AvailableSets: []string{"provider-b"},
	}

	assert.Equal(t, []string{"provider-b"}, group.GetAvailableSets())
}
