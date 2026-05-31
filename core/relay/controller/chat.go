package controller

import (
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/adaptor/openai"
	"github.com/labring/aiproxy/core/relay/utils"
)

func GetChatRequestUsage(c *gin.Context, modelConfig model.ModelConfig) (model.Usage, error) {
	textRequest, err := utils.UnmarshalGeneralOpenAIRequest(c.Request)
	if err != nil {
		return model.Usage{}, err
	}

	threshold := modelTokenCountThreshold(modelConfig)

	return model.Usage{
		InputTokens: model.ZeroNullInt64(openai.CountTokenMessagesWithThreshold(
			textRequest.Messages,
			textRequest.Model,
			false,
			threshold,
		)),
	}, nil
}

func modelTokenCountThreshold(modelConfig model.ModelConfig) int64 {
	disabled, ok := model.GetModelConfigBool(
		modelConfig.Config,
		model.ModelConfigDisablePreciseTokenCountKey,
	)
	if ok && disabled {
		return -1
	}

	threshold, ok := model.GetModelConfigInt(
		modelConfig.Config,
		model.ModelConfigFuzzyTokenThresholdKey,
	)
	if ok {
		if threshold < 0 {
			return 0
		}

		return int64(threshold)
	}

	return 0
}
