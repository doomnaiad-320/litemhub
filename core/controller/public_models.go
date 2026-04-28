package controller

import (
	"net/http"
	"slices"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
)

type PublicModelPriceResponse struct {
	InputPrice                  float64 `json:"input_price,omitempty"`
	InputPriceUnit              int64   `json:"input_price_unit,omitempty"`
	OutputPrice                 float64 `json:"output_price,omitempty"`
	OutputPriceUnit             int64   `json:"output_price_unit,omitempty"`
	PerRequestPrice             float64 `json:"per_request_price,omitempty"`
	CacheCreationPrice          float64 `json:"cache_creation_price,omitempty"`
	CacheCreationPriceUnit      int64   `json:"cache_creation_price_unit,omitempty"`
	CachedPrice                 float64 `json:"cached_price,omitempty"`
	CachedPriceUnit             int64   `json:"cached_price_unit,omitempty"`
	ImageInputPrice             float64 `json:"image_input_price,omitempty"`
	ImageInputPriceUnit         int64   `json:"image_input_price_unit,omitempty"`
	ImageOutputPrice            float64 `json:"image_output_price,omitempty"`
	ImageOutputPriceUnit        int64   `json:"image_output_price_unit,omitempty"`
	AudioInputPrice             float64 `json:"audio_input_price,omitempty"`
	AudioInputPriceUnit         int64   `json:"audio_input_price_unit,omitempty"`
	ThinkingModeOutputPrice     float64 `json:"thinking_mode_output_price,omitempty"`
	ThinkingModeOutputPriceUnit int64   `json:"thinking_mode_output_price_unit,omitempty"`
	WebSearchPrice              float64 `json:"web_search_price,omitempty"`
	WebSearchPriceUnit          int64   `json:"web_search_price_unit,omitempty"`
}

type PublicModelResponse struct {
	Model              string                        `json:"model"`
	Provider           string                        `json:"provider"`
	Capabilities       []string                      `json:"capabilities"`
	AvailableGroups    []string                      `json:"available_groups"`
	AvailableSets      []string                      `json:"available_sets"`
	ContextLength      int                           `json:"context_length,omitempty"`
	MaxInputTokens     int                           `json:"max_input_tokens,omitempty"`
	MaxOutputTokens    int                           `json:"max_output_tokens,omitempty"`
	Price              PublicModelPriceResponse      `json:"price,omitempty"`
	ImagePrices        map[string]float64            `json:"image_prices,omitempty"`
	ImageQualityPrices map[string]map[string]float64 `json:"image_quality_prices,omitempty"`
	Description        string                        `json:"description,omitempty"`
}

func GetPublicModels(c *gin.Context) {
	models, err := buildPublicModels()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"models": models,
		"total":  len(models),
	})
}

func GetPublicModel(c *gin.Context) {
	modelName := strings.Trim(strings.TrimSpace(c.Param("model")), "/")
	if modelName == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "model is required")
		return
	}

	models, err := buildPublicModels()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	for _, item := range models {
		if strings.EqualFold(item.Model, modelName) {
			middleware.SuccessResponse(c, item)
			return
		}
	}

	middleware.ErrorResponse(c, http.StatusNotFound, "model not found")
}

func buildPublicModels() ([]PublicModelResponse, error) {
	responsesByModel := make(map[string]*PublicModelResponse)
	for _, modelsInSet := range model.LoadModelCaches().EnabledModelsBySet {
		for _, modelName := range modelsInSet {
			key := strings.ToLower(modelName)
			if responsesByModel[key] == nil {
				responsesByModel[key] = buildPublicModelResponse(modelName, nil)
			}
		}
	}

	groups, err := model.GetEnabledGroups()
	if err != nil {
		return nil, err
	}

	for _, group := range groups {
		groupCache, err := model.CacheGetGroup(group.ID)
		if err != nil {
			return nil, err
		}

		models := getGroupAvailableModels(groupCache)
		modelDetails, err := buildUserGroupModelDetails(groupCache, models)
		if err != nil {
			return nil, err
		}

		detailsByModel := make(map[string]*UserGroupModelDetailResponse, len(modelDetails))
		for _, detail := range modelDetails {
			detailsByModel[strings.ToLower(detail.Model)] = detail
		}

		for _, modelName := range models {
			key := strings.ToLower(modelName)
			item := responsesByModel[key]
			if item == nil {
				detail := detailsByModel[key]
				item = buildPublicModelResponse(modelName, detail)
				responsesByModel[key] = item
			}

			item.AvailableGroups = appendUniqueString(item.AvailableGroups, group.ID)
			for _, setName := range groupCache.GetAvailableSets() {
				item.AvailableSets = appendUniqueString(item.AvailableSets, setName)
			}
		}
	}

	responses := make([]PublicModelResponse, 0, len(responsesByModel))
	for _, response := range responsesByModel {
		sort.Strings(response.AvailableGroups)
		sort.Strings(response.AvailableSets)
		responses = append(responses, *response)
	}

	sort.Slice(responses, func(i, j int) bool {
		return strings.ToLower(responses[i].Model) < strings.ToLower(responses[j].Model)
	})

	return responses, nil
}

func buildPublicModelResponse(modelName string, detail *UserGroupModelDetailResponse) *PublicModelResponse {
	config, ok := model.LoadModelCaches().EnabledModelConfigsMap[modelName]
	if !ok {
		config = model.NewDefaultModelConfig(modelName)
	}

	response := &PublicModelResponse{
		Model:              modelName,
		Provider:           inferPublicModelProvider(modelName),
		Capabilities:       inferPublicModelCapabilities(modelName, config),
		Price:              publicModelPriceFromModelPrice(config.Price),
		ImagePrices:        config.ImagePrices,
		ImageQualityPrices: config.ImageQualityPrices,
	}

	if maxContextTokens, ok := config.MaxContextTokens(); ok {
		response.ContextLength = maxContextTokens
	}
	if maxInputTokens, ok := config.MaxInputTokens(); ok {
		response.MaxInputTokens = maxInputTokens
	}
	if maxOutputTokens, ok := config.MaxOutputTokens(); ok {
		response.MaxOutputTokens = maxOutputTokens
	}

	if detail != nil {
		response.Price = publicModelPriceFromModelPrice(detail.Price)
		response.ImagePrices = detail.ImagePrices
		response.ImageQualityPrices = detail.ImageQualityPrices
	}

	response.Description = buildPublicModelDescription(response)

	return response
}

func publicModelPriceFromModelPrice(price model.Price) PublicModelPriceResponse {
	return PublicModelPriceResponse{
		InputPrice:                  float64(price.InputPrice),
		InputPriceUnit:              int64(price.InputPriceUnit),
		OutputPrice:                 float64(price.OutputPrice),
		OutputPriceUnit:             int64(price.OutputPriceUnit),
		PerRequestPrice:             float64(price.PerRequestPrice),
		CacheCreationPrice:          float64(price.CacheCreationPrice),
		CacheCreationPriceUnit:      int64(price.CacheCreationPriceUnit),
		CachedPrice:                 float64(price.CachedPrice),
		CachedPriceUnit:             int64(price.CachedPriceUnit),
		ImageInputPrice:             float64(price.ImageInputPrice),
		ImageInputPriceUnit:         int64(price.ImageInputPriceUnit),
		ImageOutputPrice:            float64(price.ImageOutputPrice),
		ImageOutputPriceUnit:        int64(price.ImageOutputPriceUnit),
		AudioInputPrice:             float64(price.AudioInputPrice),
		AudioInputPriceUnit:         int64(price.AudioInputPriceUnit),
		ThinkingModeOutputPrice:     float64(price.ThinkingModeOutputPrice),
		ThinkingModeOutputPriceUnit: int64(price.ThinkingModeOutputPriceUnit),
		WebSearchPrice:              float64(price.WebSearchPrice),
		WebSearchPriceUnit:          int64(price.WebSearchPriceUnit),
	}
}

func appendUniqueString(values []string, value string) []string {
	if value == "" || slices.Contains(values, value) {
		return values
	}

	return append(values, value)
}

func inferPublicModelProvider(modelName string) string {
	normalized := strings.ToLower(modelName)

	switch {
	case strings.HasPrefix(normalized, "gpt"), strings.HasPrefix(normalized, "o1"), strings.HasPrefix(normalized, "o3"), strings.HasPrefix(normalized, "o4"):
		return "OpenAI"
	case strings.HasPrefix(normalized, "claude"):
		return "Anthropic"
	case strings.HasPrefix(normalized, "gemini"):
		return "Google"
	case strings.HasPrefix(normalized, "grok"):
		return "xAI"
	case strings.HasPrefix(normalized, "qwen"):
		return "Qwen"
	case strings.HasPrefix(normalized, "deepseek"):
		return "DeepSeek"
	case strings.HasPrefix(normalized, "kimi"):
		return "Moonshot"
	case strings.HasPrefix(normalized, "glm"):
		return "Zhipu"
	case strings.HasPrefix(normalized, "doubao"):
		return "Doubao"
	case strings.HasPrefix(normalized, "llama"):
		return "Meta"
	case strings.HasPrefix(normalized, "mistral"):
		return "Mistral"
	default:
		return "Model"
	}
}

func inferPublicModelCapabilities(modelName string, config model.ModelConfig) []string {
	normalized := strings.ToLower(modelName)
	capabilities := make([]string, 0, 4)

	add := func(capability string) {
		if !slices.Contains(capabilities, capability) {
			capabilities = append(capabilities, capability)
		}
	}

	isEmbedding := containsAny(normalized, "embedding", "text-embedding", "bge", "gte", "e5")
	isRerank := containsAny(normalized, "rerank", "reranker")
	isImage := containsAny(normalized, "gpt-image", "dall", "image", "imagen", "flux", "stable-diffusion", "sdxl", "sd-")
	isAudio := containsAny(normalized, "audio", "speech", "tts", "whisper", "voice", "realtime", "transcribe")
	isVideo := containsAny(normalized, "video", "veo", "sora", "wanx")
	isVision := containsAny(normalized, "vision", "vl", "omni", "gpt-4o", "gemini", "claude", "pixtral", "llava")
	isReasoning := strings.HasPrefix(normalized, "o1") ||
		strings.HasPrefix(normalized, "o3") ||
		strings.HasPrefix(normalized, "o4") ||
		containsAny(normalized, "reason", "thinking", "r1", "sonnet-4", "opus-4")
	isCoding := containsAny(normalized, "coder", "codestral", "devstral", "codegen", "codegemma", "qwen-coder", "deepseek-coder")

	if vision, ok := config.SupportVision(); ok && vision {
		isVision = true
	}
	if toolChoice, ok := config.SupportToolChoice(); ok && toolChoice {
		add("tools")
	}
	if formats, ok := config.SupportFormats(); ok {
		for _, format := range formats {
			if strings.EqualFold(format, "json") {
				add("json")
				break
			}
		}
	}

	if isVision {
		add("vision")
	}
	if isReasoning {
		add("reasoning")
	}
	if isImage {
		add("image")
	}
	if isAudio {
		add("audio")
	}
	if isVideo {
		add("video")
	}
	if isCoding {
		add("coding")
	}
	if isEmbedding {
		add("embedding")
	}
	if isRerank {
		add("rerank")
	}

	if (!isEmbedding && !isRerank && !isImage && !isAudio && !isVideo) ||
		isVision || isReasoning || isCoding {
		add("text")
	}

	sort.SliceStable(capabilities, func(i, j int) bool {
		return publicCapabilityOrder(capabilities[i]) < publicCapabilityOrder(capabilities[j])
	})

	return capabilities
}

func containsAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(value, needle) {
			return true
		}
	}

	return false
}

func publicCapabilityOrder(capability string) int {
	order := []string{"text", "reasoning", "vision", "tools", "json", "image", "audio", "video", "coding", "embedding", "rerank"}
	for index, item := range order {
		if capability == item {
			return index
		}
	}

	return len(order)
}

func buildPublicModelDescription(item *PublicModelResponse) string {
	if item == nil {
		return ""
	}

	capabilities := strings.Join(item.Capabilities, ", ")
	if capabilities == "" {
		capabilities = "AI"
	}

	return item.Model + " is available through the AIProxy OpenAI-compatible API with " + capabilities + " capabilities."
}
