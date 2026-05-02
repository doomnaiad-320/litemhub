package controller

import (
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/adaptor/openai"
	relaymodel "github.com/labring/aiproxy/core/relay/model"
)

func GetResponsesRequestUsage(c *gin.Context, _ model.ModelConfig) (model.Usage, error) {
	var responseReq relaymodel.CreateResponseRequest
	if err := common.UnmarshalRequestReusable(c.Request, &responseReq); err != nil {
		return model.Usage{}, err
	}

	inputTokens := countResponsesInputTokens(responseReq.Input, responseReq.Model)
	if responseReq.Instructions != nil {
		inputTokens += openai.CountTokenText(*responseReq.Instructions, responseReq.Model)
	}

	return model.Usage{
		InputTokens: model.ZeroNullInt64(inputTokens),
	}, nil
}

func countResponsesInputTokens(input any, modelName string) int64 {
	switch v := input.(type) {
	case string:
		return openai.CountTokenText(v, modelName)
	case []any:
		var tokens int64
		for _, item := range v {
			tokens += countResponsesInputTokens(item, modelName)
		}

		return tokens
	case []string:
		return openai.CountTokenInput(v, modelName)
	case map[string]any:
		var tokens int64
		for _, key := range []string{"input", "content", "text"} {
			if value, ok := v[key]; ok {
				tokens += countResponsesInputTokens(value, modelName)
			}
		}

		return tokens
	default:
		return openai.CountTokenInput(input, modelName)
	}
}
