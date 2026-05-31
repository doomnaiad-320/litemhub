package openai

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/bytedance/sonic/ast"
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common"
	coremodel "github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/adaptor"
	"github.com/labring/aiproxy/core/relay/meta"
	relaymodel "github.com/labring/aiproxy/core/relay/model"
	"github.com/labring/aiproxy/core/relay/render"
	"github.com/labring/aiproxy/core/relay/utils"
)

func shouldUseChatCompletionsStreamFastPath(
	meta *meta.Meta,
	preHandler PreHandler,
) bool {
	if preHandler != nil {
		return false
	}

	enabled, ok := coremodel.GetModelConfigBool(
		meta.ModelConfig.Config,
		coremodel.ModelConfigChatCompletionsStreamFastPathKey,
	)
	if ok {
		return enabled
	}

	return false
}

func ChatCompletionsStreamFastPathHandler(
	meta *meta.Meta,
	c *gin.Context,
	resp *http.Response,
) (adaptor.DoResponseResult, adaptor.Error) {
	if resp.StatusCode != http.StatusOK {
		return adaptor.DoResponseResult{}, ErrorHanlder(resp)
	}

	defer resp.Body.Close()

	log := common.GetLogger(c)

	scanner, cleanup := utils.NewStreamScanner(resp.Body, meta.ActualModel)
	defer cleanup()

	var (
		responseText strings.Builder
		usage        relaymodel.ChatUsage
		upstreamID   string
	)

	for scanner.Scan() {
		data := scanner.Bytes()
		if !render.IsValidSSEData(data) {
			continue
		}

		data = render.ExtractSSEData(data)
		if render.IsSSEDone(data) {
			break
		}

		node, err := sonic.GetWithOptions(data, ast.SearchOptions{})
		if err != nil {
			log.Error("error unmarshalling stream response: " + err.Error())
			continue
		}

		u, err := getUsageFromStreamNode(&node)
		if err != nil {
			log.Error("error unmarshalling stream usage: " + err.Error())
			continue
		}
		if u != nil {
			usage = *u
			responseText.Reset()
		}

		if upstreamID == "" {
			upstreamID = getIDFromStreamNode(&node)
		}

		if usage.TotalTokens == 0 {
			appendStreamText(&responseText, &node)
		}

		_, err = node.Set("model", ast.NewString(meta.OriginModel))
		if err != nil {
			log.Error("error set model: " + err.Error())
		}

		newData, err := node.MarshalJSON()
		if err != nil {
			log.Error("error marshalling stream response: " + err.Error())
			continue
		}

		render.OpenaiBytesData(c, newData)
	}

	if err := scanner.Err(); err != nil {
		log.Error("error reading stream: " + err.Error())
	}

	if usage.TotalTokens == 0 && responseText.Len() > 0 {
		usage = ResponseText2Usage(
			responseText.String(),
			meta.ActualModel,
			int64(meta.RequestUsage.InputTokens),
		)
		_ = render.OpenaiObjectData(c, &relaymodel.ChatCompletionsStreamResponse{
			ID:      ChatCompletionID(),
			Model:   meta.OriginModel,
			Object:  relaymodel.ChatCompletionChunkObject,
			Created: time.Now().Unix(),
			Choices: []*relaymodel.ChatCompletionsStreamResponseChoice{},
			Usage:   &usage,
		})
	} else if usage.TotalTokens != 0 && usage.PromptTokens == 0 {
		usage.PromptTokens = int64(meta.RequestUsage.InputTokens)
		usage.CompletionTokens = usage.TotalTokens - int64(meta.RequestUsage.InputTokens)
	}

	render.OpenaiDone(c)

	return adaptor.DoResponseResult{
		Usage:      usage.ToModelUsage(),
		UpstreamID: upstreamID,
	}, nil
}

func getUsageFromStreamNode(node *ast.Node) (*relaymodel.ChatUsage, error) {
	usageNode := node.Get("usage")
	if usageNode == nil || usageNode.TypeSafe() == ast.V_NULL {
		return nil, nil
	}

	usageRaw, err := usageNode.Raw()
	if err != nil {
		if errors.Is(err, ast.ErrNotExist) {
			return nil, nil
		}

		return nil, err
	}

	var usage relaymodel.ChatUsage
	if err := sonic.UnmarshalString(usageRaw, &usage); err != nil {
		return nil, err
	}

	return &usage, nil
}

func getIDFromStreamNode(node *ast.Node) string {
	idNode := node.Get("id")
	if idNode == nil || !idNode.Exists() || idNode.TypeSafe() == ast.V_NULL {
		return ""
	}

	id, err := idNode.String()
	if err != nil {
		return ""
	}

	return id
}

func appendStreamText(responseText *strings.Builder, node *ast.Node) {
	choicesNode := node.Get("choices")
	if choicesNode == nil || !choicesNode.Exists() || choicesNode.TypeSafe() != ast.V_ARRAY {
		return
	}

	_ = choicesNode.ForEach(func(_ ast.Sequence, choice *ast.Node) bool {
		appendChoiceText(responseText, choice)
		return true
	})
}

func appendChoiceText(responseText *strings.Builder, choice *ast.Node) {
	textNode := choice.Get("text")
	if textNode != nil && textNode.TypeSafe() == ast.V_STRING {
		if text, err := textNode.String(); err == nil {
			responseText.WriteString(text)
		}

		return
	}

	deltaNode := choice.Get("delta")
	if deltaNode == nil || deltaNode.TypeSafe() == ast.V_NULL {
		return
	}

	for _, key := range []string{"reasoning_content", "content"} {
		contentNode := deltaNode.Get(key)
		if contentNode == nil || contentNode.TypeSafe() != ast.V_STRING {
			continue
		}

		if content, err := contentNode.String(); err == nil {
			responseText.WriteString(content)
		}

		return
	}
}
