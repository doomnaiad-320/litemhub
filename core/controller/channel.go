package controller

import (
	"context"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller/utils"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/monitor"
	"github.com/labring/aiproxy/core/relay/adaptors"
	"github.com/labring/aiproxy/core/relay/meta"
	"github.com/labring/aiproxy/core/relay/mode"
	relayutils "github.com/labring/aiproxy/core/relay/utils"
	log "github.com/sirupsen/logrus"
)

// ChannelTypeMetas godoc
//
//	@Summary		Get channel type metadata
//	@Description	Returns metadata for all channel types
//	@Tags			channels
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Success		200	{object}	middleware.APIResponse{data=map[int]adaptors.AdaptorMeta}
//	@Router			/api/channels/type_metas [get]
func ChannelTypeMetas(c *gin.Context) {
	middleware.SuccessResponse(c, adaptors.ChannelMetas)
}

type ChannelResponse struct {
	*model.Channel
	Group      string    `json:"group,omitempty"`
	AccessedAt time.Time `json:"accessed_at,omitempty"`
}

type DiscoverChannelModelsRequest struct {
	Configs       model.ChannelConfigs `json:"configs"`
	Key           string               `json:"key"`
	BaseURL       string               `json:"base_url"`
	ProxyURL      string               `json:"proxy_url"`
	Type          model.ChannelType    `json:"type"`
	SkipTLSVerify bool                 `json:"skip_tls_verify"`
}

type DiscoveredChannelModel struct {
	Model         string    `json:"model"`
	UpstreamModel string    `json:"upstream_model"`
	Exists        bool      `json:"exists"`
	Priced        bool      `json:"priced"`
	Type          mode.Mode `json:"type"`
}

type DiscoverChannelModelsResponse struct {
	Models []DiscoveredChannelModel `json:"models"`
}

type upstreamModelsResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

func (c *ChannelResponse) MarshalJSON() ([]byte, error) {
	type Alias model.Channel

	accessedAt := int64(0)
	if !c.AccessedAt.IsZero() {
		accessedAt = c.AccessedAt.UnixMilli()
	}

	return sonic.Marshal(&struct {
		*Alias
		Group            string `json:"group,omitempty"`
		CreatedAt        int64  `json:"created_at"`
		BalanceUpdatedAt int64  `json:"balance_updated_at"`
		LastTestErrorAt  int64  `json:"last_test_error_at"`
		AccessedAt       int64  `json:"accessed_at,omitempty"`
	}{
		Alias:            (*Alias)(c.Channel),
		Group:            c.Group,
		CreatedAt:        c.CreatedAt.UnixMilli(),
		BalanceUpdatedAt: c.BalanceUpdatedAt.UnixMilli(),
		LastTestErrorAt:  c.LastTestErrorAt.UnixMilli(),
		AccessedAt:       accessedAt,
	})
}

func buildChannelResponse(channel *model.Channel) *ChannelResponse {
	lastRequestAt, _ := model.GetChannelLastRequestTimeMinute(channel.ID)

	return &ChannelResponse{
		Channel:    channel,
		Group:      firstChannelGroup(channel.Sets),
		AccessedAt: lastRequestAt,
	}
}

func firstChannelGroup(sets []string) string {
	if len(sets) == 0 {
		return ""
	}

	return sets[0]
}

func buildChannelResponses(channels []*model.Channel) []*ChannelResponse {
	responses := make([]*ChannelResponse, len(channels))
	for i, channel := range channels {
		responses[i] = buildChannelResponse(channel)
	}

	return responses
}

func inferModelConfigType(channelType model.ChannelType, modelName string) mode.Mode {
	if a, ok := adaptors.GetAdaptor(channelType); ok {
		for _, builtInModel := range a.Metadata().Models {
			if builtInModel.Model == modelName && builtInModel.Type != mode.Unknown {
				return builtInModel.Type
			}
		}
	}

	normalized := strings.ToLower(modelName)
	switch {
	case strings.Contains(normalized, "embedding"):
		return mode.Embeddings
	case strings.Contains(normalized, "image"):
		return mode.ImagesGenerations
	case strings.Contains(normalized, "tts"):
		return mode.AudioSpeech
	case strings.Contains(normalized, "transcribe"):
		return mode.AudioTranscription
	case strings.Contains(normalized, "moderation"):
		return mode.Moderations
	default:
		return mode.ChatCompletions
	}
}

func ensureChannelModelConfigs(channels []*model.Channel) error {
	modelTypes := map[string]mode.Mode{}
	for _, channel := range channels {
		for _, modelName := range channel.Models {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			if _, ok := modelTypes[modelName]; ok {
				continue
			}

			modelTypes[modelName] = inferModelConfigType(channel.Type, modelName)
		}
	}

	for modelName, modelType := range modelTypes {
		if _, err := model.CreateMissingModelConfigs([]string{modelName}, modelType); err != nil {
			return err
		}
	}

	return nil
}

func discoverChannelModels(
	ctx context.Context,
	req DiscoverChannelModelsRequest,
) (DiscoverChannelModelsResponse, error) {
	a, ok := adaptors.GetAdaptor(req.Type)
	if !ok {
		return DiscoverChannelModelsResponse{}, fmt.Errorf("invalid channel type: %d", req.Type)
	}

	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = a.DefaultBaseURL()
	}
	if baseURL == "" {
		return DiscoverChannelModelsResponse{}, fmt.Errorf("base_url is required")
	}

	endpoint, err := url.JoinPath(baseURL, "models")
	if err != nil {
		return DiscoverChannelModelsResponse{}, err
	}

	channel := &model.Channel{
		Type:          req.Type,
		Key:           req.Key,
		BaseURL:       baseURL,
		ProxyURL:      req.ProxyURL,
		SkipTLSVerify: req.SkipTLSVerify,
		Configs:       req.Configs,
	}
	m := meta.NewMeta(channel, mode.ChatCompletions, "", model.ModelConfig{})
	m.RequestTimeout = 30 * time.Second

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return DiscoverChannelModelsResponse{}, err
	}
	setupContext := &gin.Context{Request: &http.Request{Header: make(http.Header)}}
	if err := a.SetupRequestHeader(m, nil, setupContext, httpReq); err != nil {
		return DiscoverChannelModelsResponse{}, err
	}

	resp, err := relayutils.DoRequestWithMeta(httpReq, m)
	if err != nil {
		return DiscoverChannelModelsResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return DiscoverChannelModelsResponse{}, fmt.Errorf(
			"fetch upstream models failed: status %d: %s",
			resp.StatusCode,
			strings.TrimSpace(string(body)),
		)
	}

	var upstream upstreamModelsResponse
	if err := sonic.ConfigDefault.NewDecoder(resp.Body).Decode(&upstream); err != nil {
		return DiscoverChannelModelsResponse{}, err
	}

	modelNames := make([]string, 0, len(upstream.Data))
	seen := make(map[string]struct{}, len(upstream.Data))
	for _, item := range upstream.Data {
		modelName := strings.TrimSpace(item.ID)
		if modelName == "" {
			continue
		}
		if _, ok := seen[modelName]; ok {
			continue
		}

		seen[modelName] = struct{}{}
		modelNames = append(modelNames, modelName)
	}
	slices.Sort(modelNames)

	existingConfigs, _, err := model.GetModelConfigWithModels(modelNames)
	if err != nil {
		return DiscoverChannelModelsResponse{}, err
	}

	configs := make(map[string]model.ModelConfig, len(existingConfigs))
	if len(existingConfigs) > 0 {
		modelConfigs, err := model.GetModelConfigsByModels(existingConfigs)
		if err != nil {
			return DiscoverChannelModelsResponse{}, err
		}
		for _, cfg := range modelConfigs {
			configs[cfg.Model] = cfg
		}
	}

	result := DiscoverChannelModelsResponse{
		Models: make([]DiscoveredChannelModel, 0, len(modelNames)),
	}
	for _, modelName := range modelNames {
		cfg, exists := configs[modelName]
		modelType := inferModelConfigType(req.Type, modelName)
		priced := false
		if exists {
			modelType = cfg.Type
			priced = cfg.HasBillablePrice() || cfg.AllowsZeroPrice()
		}

		result.Models = append(result.Models, DiscoveredChannelModel{
			Model:         modelName,
			UpstreamModel: modelName,
			Exists:        exists,
			Priced:        priced,
			Type:          modelType,
		})
	}

	return result, nil
}

// GetChannels godoc
//
//	@Summary		Get channels with pagination
//	@Description	Returns a paginated list of channels with optional filters
//	@Tags			channels
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			page			query		int		false	"Page number"
//	@Param			per_page		query		int		false	"Items per page"
//	@Param			id				query		int		false	"Filter by id"
//	@Param			name			query		string	false	"Filter by name"
//	@Param			key				query		string	false	"Filter by key"
//	@Param			channel_type	query		int		false	"Filter by channel type"
//	@Param			base_url		query		string	false	"Filter by base URL"
//	@Param			order			query		string	false	"Order by field"
//	@Success		200				{object}	middleware.APIResponse{data=map[string]any{channels=[]model.Channel,total=int}}
//	@Router			/api/channels/ [get]
func GetChannels(c *gin.Context) {
	page, perPage := utils.ParsePageParams(c)
	id, _ := strconv.Atoi(c.Query("id"))
	name := c.Query("name")
	key := c.Query("key")
	channelType, _ := strconv.Atoi(c.Query("channel_type"))
	baseURL := c.Query("base_url")
	order := c.Query("order")

	channels, total, err := model.GetChannels(
		page,
		perPage,
		id,
		name,
		key,
		channelType,
		baseURL,
		order,
	)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"channels": buildChannelResponses(channels),
		"total":    total,
	})
}

// GetAllChannels godoc
//
//	@Summary		Get all channels
//	@Description	Returns a list of all channels without pagination
//	@Tags			channels
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Success		200	{object}	middleware.APIResponse{data=[]model.Channel}
//	@Router			/api/channels/all [get]
func GetAllChannels(c *gin.Context) {
	channels, err := model.GetAllChannels()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, buildChannelResponses(channels))
}

// AddChannels godoc
//
//	@Summary		Add multiple channels
//	@Description	Adds multiple channels in a batch operation
//	@Tags			channels
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			channels	body		[]AddChannelRequest	true	"Channel information"
//	@Success		200			{object}	middleware.APIResponse
//	@Router			/api/channels/ [post]
func AddChannels(c *gin.Context) {
	channels := make([]*AddChannelRequest, 0)

	err := c.ShouldBindJSON(&channels)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	_channels := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		channels, err := channel.ToChannels()
		if err != nil {
			middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
			return
		}

		_channels = append(_channels, channels...)
	}

	err = ensureChannelModelConfigs(_channels)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	err = model.BatchInsertChannels(_channels)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

// SearchChannels godoc
//
//	@Summary		Search channels
//	@Description	Search channels with keyword and optional filters
//	@Tags			channels
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			keyword			query		string	true	"Search keyword"
//	@Param			page			query		int		false	"Page number"
//	@Param			per_page		query		int		false	"Items per page"
//	@Param			id				query		int		false	"Filter by id"
//	@Param			name			query		string	false	"Filter by name"
//	@Param			key				query		string	false	"Filter by key"
//	@Param			channel_type	query		int		false	"Filter by channel type"
//	@Param			base_url		query		string	false	"Filter by base URL"
//	@Param			order			query		string	false	"Order by field"
//	@Success		200				{object}	middleware.APIResponse{data=map[string]any{channels=[]model.Channel,total=int}}
//	@Router			/api/channels/search [get]
func SearchChannels(c *gin.Context) {
	keyword := c.Query("keyword")
	page, perPage := utils.ParsePageParams(c)
	id, _ := strconv.Atoi(c.Query("id"))
	name := c.Query("name")
	key := c.Query("key")
	channelType, _ := strconv.Atoi(c.Query("channel_type"))
	baseURL := c.Query("base_url")
	order := c.Query("order")

	channels, total, err := model.SearchChannels(
		keyword,
		page,
		perPage,
		id,
		name,
		key,
		channelType,
		baseURL,
		order,
	)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"channels": buildChannelResponses(channels),
		"total":    total,
	})
}

// GetChannel godoc
//
//	@Summary		Get a channel by ID
//	@Description	Returns detailed information about a specific channel
//	@Tags			channel
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			id	path		int	true	"Channel ID"
//	@Success		200	{object}	middleware.APIResponse{data=model.Channel}
//	@Router			/api/channel/{id} [get]
func GetChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	channel, err := model.GetChannelByID(id)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, buildChannelResponse(channel))
}

// DiscoverChannelModels godoc
//
//	@Summary		Discover upstream channel models
//	@Description	Fetches OpenAI-compatible /models from an unsaved channel config
//	@Tags			channel
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			channel	body		DiscoverChannelModelsRequest	true	"Channel connection information"
//	@Success		200		{object}	middleware.APIResponse{data=DiscoverChannelModelsResponse}
//	@Router			/api/channel/discover-models [post]
func DiscoverChannelModels(c *gin.Context) {
	req := DiscoverChannelModelsRequest{}

	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.Type == 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "type is required")
		return
	}
	if strings.TrimSpace(req.Key) == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "key is required")
		return
	}

	result, err := discoverChannelModels(c.Request.Context(), req)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadGateway, err.Error())
		return
	}

	middleware.SuccessResponse(c, result)
}

// AddChannelRequest represents the request body for adding a channel
type AddChannelRequest struct {
	ModelMapping            map[string]string    `json:"model_mapping"`
	Configs                 model.ChannelConfigs `json:"configs"`
	Name                    string               `json:"name"`
	Key                     string               `json:"key"`
	BaseURL                 string               `json:"base_url"`
	ProxyURL                string               `json:"proxy_url"`
	Models                  []string             `json:"models"`
	Type                    model.ChannelType    `json:"type"`
	Priority                int32                `json:"priority"`
	Status                  int                  `json:"status"`
	Group                   string               `json:"group"`
	Sets                    []string             `json:"sets"`
	EnabledAutoBalanceCheck bool                 `json:"enabled_auto_balance_check"`
	SkipTLSVerify           bool                 `json:"skip_tls_verify"`
	EnabledNoPermissionBan  bool                 `json:"enabled_no_permission_ban"`
	WarnErrorRate           float64              `json:"warn_error_rate"`
	MaxErrorRate            float64              `json:"max_error_rate"`
}

func (r *AddChannelRequest) ToChannel() (*model.Channel, error) {
	a, ok := adaptors.GetAdaptor(r.Type)
	if !ok {
		return nil, fmt.Errorf("invalid channel type: %d", r.Type)
	}

	metadata := a.Metadata()
	if validator := adaptors.GetKeyValidator(a); validator != nil {
		err := validator.ValidateKey(r.Key)
		if err != nil {
			keyHelp := metadata.KeyHelp
			if keyHelp == "" {
				return nil, fmt.Errorf(
					"%s [%s(%d)] invalid key: %w",
					r.Name,
					r.Type.String(),
					r.Type,
					err,
				)
			}

			return nil, fmt.Errorf(
				"%s [%s(%d)] invalid key: %w, %s",
				r.Name,
				r.Type.String(),
				r.Type,
				err,
				keyHelp,
			)
		}
	}

	if r.Group != "" {
		if _, err := model.GetGroupByID(r.Group, false); err != nil {
			return nil, err
		}
	}

	for _, set := range r.Sets {
		set = strings.TrimSpace(set)
		if set == "" {
			continue
		}

		if _, err := model.GetGroupByID(set, false); err != nil {
			return nil, err
		}
	}

	return &model.Channel{
		Type:                    r.Type,
		Name:                    r.Name,
		Key:                     r.Key,
		BaseURL:                 r.BaseURL,
		ProxyURL:                r.ProxyURL,
		Models:                  slices.Clone(r.Models),
		ModelMapping:            maps.Clone(r.ModelMapping),
		Priority:                r.Priority,
		Status:                  r.Status,
		Configs:                 r.Configs,
		Sets:                    buildChannelSets(r.Group, r.Sets),
		EnabledAutoBalanceCheck: r.EnabledAutoBalanceCheck,
		SkipTLSVerify:           r.SkipTLSVerify,
		EnabledNoPermissionBan:  r.EnabledNoPermissionBan,
		WarnErrorRate:           r.WarnErrorRate,
		MaxErrorRate:            r.MaxErrorRate,
	}, nil
}

func buildChannelSets(group string, sets []string) []string {
	group = strings.TrimSpace(group)
	if group != "" {
		return []string{group}
	}

	normalizedSets := make([]string, 0, len(sets))
	seen := make(map[string]struct{}, len(sets))
	for _, set := range sets {
		set = strings.TrimSpace(set)
		if set == "" {
			continue
		}

		if _, ok := seen[set]; ok {
			continue
		}

		seen[set] = struct{}{}
		normalizedSets = append(normalizedSets, set)
	}

	return normalizedSets
}

func (r *AddChannelRequest) ToChannels() ([]*model.Channel, error) {
	keys := strings.Split(r.Key, "\n")

	channels := make([]*model.Channel, 0, len(keys))
	for _, key := range keys {
		if key == "" {
			continue
		}

		c, err := r.ToChannel()
		if err != nil {
			return nil, err
		}

		c.Key = key
		channels = append(channels, c)
	}

	if len(channels) == 0 {
		ch, err := r.ToChannel()
		if err != nil {
			return nil, err
		}

		return []*model.Channel{ch}, nil
	}

	return channels, nil
}

// AddChannel godoc
//
//	@Summary		Add a single channel
//	@Description	Adds a new channel to the system
//	@Tags			channel
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			channel	body		AddChannelRequest	true	"Channel information"
//	@Success		200		{object}	middleware.APIResponse
//	@Router			/api/channel/ [post]
func AddChannel(c *gin.Context) {
	channel := AddChannelRequest{}

	err := c.ShouldBindJSON(&channel)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	channels, err := channel.ToChannels()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	err = ensureChannelModelConfigs(channels)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	err = model.BatchInsertChannels(channels)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

// DeleteChannel godoc
//
//	@Summary		Delete a channel
//	@Description	Deletes a channel by its ID
//	@Tags			channel
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			id	path		int	true	"Channel ID"
//	@Success		200	{object}	middleware.APIResponse
//	@Router			/api/channel/{id} [delete]
func DeleteChannel(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	err := model.DeleteChannelByID(id)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

// DeleteChannels godoc
//
//	@Summary		Delete multiple channels
//	@Description	Deletes multiple channels by their IDs
//	@Tags			channels
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			ids	body		[]int	true	"Channel IDs"
//	@Success		200	{object}	middleware.APIResponse
//	@Router			/api/channels/batch_delete [post]
func DeleteChannels(c *gin.Context) {
	ids := []int{}

	err := c.ShouldBindJSON(&ids)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	err = model.DeleteChannelsByIDs(ids)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

// GetChannelBatchInfo godoc
//
//	@Summary		Get basic info for multiple channels
//	@Description	Returns id, name, and type for a batch of channel IDs
//	@Tags			channels
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			ids	body		[]int	true	"Channel IDs"
//	@Success		200	{object}	middleware.APIResponse{data=[]model.ChannelBasicInfo}
//	@Router			/api/channels/batch_info [post]
func GetChannelBatchInfo(c *gin.Context) {
	ids := []int{}

	err := c.ShouldBindJSON(&ids)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	channels, err := model.GetChannelsBasicInfoByIDs(ids)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, channels)
}

// UpdateChannel godoc
//
//	@Summary		Update a channel
//	@Description	Updates an existing channel by its ID
//	@Tags			channel
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			id		path		int					true	"Channel ID"
//	@Param			channel	body		AddChannelRequest	true	"Updated channel information"
//	@Success		200		{object}	middleware.APIResponse{data=model.Channel}
//	@Router			/api/channel/{id} [put]
func UpdateChannel(c *gin.Context) {
	idStr := c.Param("id")
	if idStr == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "id is required")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	channel := AddChannelRequest{}

	err = c.ShouldBindJSON(&channel)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	ch, err := channel.ToChannel()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	ch.ID = id

	err = ensureChannelModelConfigs([]*model.Channel{ch})
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	err = model.UpdateChannel(ch)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	err = monitor.ClearChannelAllModelErrors(c.Request.Context(), id)
	if err != nil {
		log.Errorf("failed to clear channel all model errors: %+v", err)
	}

	middleware.SuccessResponse(c, ch)
}

// UpdateChannelStatusRequest represents the request body for updating a channel's status
type UpdateChannelStatusRequest struct {
	Status int `json:"status"`
}

// UpdateChannelStatus godoc
//
//	@Summary		Update channel status
//	@Description	Updates the status of a channel by its ID
//	@Tags			channel
//	@Accept			json
//	@Produce		json
//	@Security		ApiKeyAuth
//	@Param			id		path		int							true	"Channel ID"
//	@Param			status	body		UpdateChannelStatusRequest	true	"Status information"
//	@Success		200		{object}	middleware.APIResponse
//	@Router			/api/channel/{id}/status [post]
func UpdateChannelStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	status := UpdateChannelStatusRequest{}

	err := c.ShouldBindJSON(&status)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	err = model.UpdateChannelStatusByID(id, status.Status)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	err = monitor.ClearChannelAllModelErrors(c.Request.Context(), id)
	if err != nil {
		log.Errorf("failed to clear channel all model errors: %+v", err)
	}

	middleware.SuccessResponse(c, nil)
}
