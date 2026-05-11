//nolint:testpackage
package controller

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/mode"
	log "github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

type testModelConfigCache map[string]model.ModelConfig

func (c testModelConfigCache) GetModelConfig(modelName string) (model.ModelConfig, bool) {
	config, ok := c[modelName]
	return config, ok
}

func TestRunAutoTestBannedModelsHonorsConcurrencyLimit(t *testing.T) {
	const (
		concurrency = 7
		totalJobs   = 41
	)

	channels := map[string][]int64{
		"model-a": make([]int64, totalJobs),
	}
	for i := range totalJobs {
		channels["model-a"][i] = int64(i + 1)
	}

	var (
		currentActive atomic.Int32
		maxActive     atomic.Int32
		processed     atomic.Int32
	)

	deps := autoTestBannedModelsDeps{
		tryTestChannel: func(channelID int, modelName string) bool {
			return true
		},
		loadChannelByID: func(id int) (*model.Channel, error) {
			return &model.Channel{
				ID:     id,
				Name:   "channel",
				Type:   model.ChannelTypeOpenAI,
				Status: model.ChannelStatusEnabled,
				Models: []string{"model-a"},
			}, nil
		},
		testSingleModel: func(mc *model.ModelCaches, channel *model.Channel, modelName string, saveToDB bool) (*model.ChannelTest, error) {
			active := currentActive.Add(1)
			for {
				previous := maxActive.Load()
				if active <= previous || maxActive.CompareAndSwap(previous, active) {
					break
				}
			}

			time.Sleep(15 * time.Millisecond)

			processed.Add(1)
			currentActive.Add(-1)

			return &model.ChannelTest{Success: true}, nil
		},
		clearChannelModelErrors: func(ctx context.Context, modelName string, channelID int) error {
			return nil
		},
		notifyInfo:  func(title, message string) {},
		notifyError: func(title, message string) {},
	}

	runAutoTestBannedModels(log.NewEntry(log.StandardLogger()), channels, nil, concurrency, deps)

	require.Equal(t, int32(totalJobs), processed.Load())
	require.LessOrEqual(t, maxActive.Load(), int32(concurrency))
}

func TestRunAutoTestBannedModelsClearsWhenModelRemovedFromChannel(t *testing.T) {
	var (
		cleared        atomic.Int32
		testInvoked    atomic.Bool
		clearedChannel atomic.Int64
	)

	deps := autoTestBannedModelsDeps{
		tryTestChannel: func(channelID int, modelName string) bool {
			return true
		},
		loadChannelByID: func(id int) (*model.Channel, error) {
			return &model.Channel{
				ID:     id,
				Name:   "channel",
				Type:   model.ChannelTypeOpenAI,
				Status: model.ChannelStatusEnabled,
				Models: []string{"another-model"},
			}, nil
		},
		testSingleModel: func(mc *model.ModelCaches, channel *model.Channel, modelName string, saveToDB bool) (*model.ChannelTest, error) {
			testInvoked.Store(true)
			return &model.ChannelTest{Success: true}, nil
		},
		clearChannelModelErrors: func(ctx context.Context, modelName string, channelID int) error {
			cleared.Add(1)
			clearedChannel.Store(int64(channelID))
			return nil
		},
		notifyInfo:  func(title, message string) {},
		notifyError: func(title, message string) {},
	}

	runAutoTestBannedModels(
		log.NewEntry(log.StandardLogger()),
		map[string][]int64{"removed-model": {123}},
		nil,
		1,
		deps,
	)

	require.False(t, testInvoked.Load())
	require.Equal(t, int32(1), cleared.Load())
	require.Equal(t, int64(123), clearedChannel.Load())
}

func TestGetChannelTestModelConfigUsesOriginModelForMappedName(t *testing.T) {
	mc := &model.ModelCaches{
		ModelConfig: testModelConfigCache{
			"public-model": {
				Model: "public-model",
				Type:  mode.ChatCompletions,
				Price: model.Price{
					InputPrice:  1,
					OutputPrice: 2,
				},
			},
		},
	}
	channel := &model.Channel{
		ModelMapping: map[string]string{
			"public-model": "upstream-model-without-price-config",
		},
	}

	originModel, config, ok := getChannelTestModelConfig(
		mc,
		channel,
		"upstream-model-without-price-config",
	)

	require.True(t, ok)
	require.Equal(t, "public-model", originModel)
	require.Equal(t, "public-model", config.Model)
	require.Equal(t, model.ZeroNullFloat64(1), config.Price.InputPrice)
	require.Equal(t, model.ZeroNullFloat64(2), config.Price.OutputPrice)
}

func TestGetChannelTestModelConfigHandlesNilCache(t *testing.T) {
	originModel, config, ok := getChannelTestModelConfig(nil, nil, "custom-model")

	require.False(t, ok)
	require.Equal(t, "custom-model", originModel)
	require.Equal(t, model.ModelConfig{}, config)
}

func TestBuildFallbackChannelTestModelConfigUsesConfiguredModelName(t *testing.T) {
	channel := &model.Channel{
		Type: model.ChannelTypeOpenAI,
		ModelMapping: map[string]string{
			"public-model": "upstream-model-without-config",
		},
	}

	config := buildFallbackChannelTestModelConfig(channel, "public-model")

	require.Equal(t, "public-model", config.Model)
	require.Equal(t, mode.ChatCompletions, config.Type)
}

func TestBuildFallbackChannelTestModelConfigInfersTypeFromMappedModelName(t *testing.T) {
	channel := &model.Channel{
		Type: model.ChannelTypeOpenAI,
		ModelMapping: map[string]string{
			"public-image-model": "upstream-image-model-without-config",
		},
	}

	config := buildFallbackChannelTestModelConfig(channel, "public-image-model")

	require.Equal(t, "public-image-model", config.Model)
	require.Equal(t, mode.ImagesGenerations, config.Type)
}
