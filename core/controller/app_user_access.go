package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller/utils"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"gorm.io/gorm"
)

type CreateAppUserKeyRequest struct {
	Group     string   `json:"group"`
	Name      string   `json:"name"`
	Subnets   []string `json:"subnets"`
	Models    []string `json:"models"`
	Quota     float64  `json:"quota"`
	ExpiredAt int64    `json:"expired_at"`
}

type UpdateAppUserKeyRequest struct {
	Group     string   `json:"group"`
	Models    []string `json:"models"`
	Quota     *float64 `json:"quota"`
	ExpiredAt *int64   `json:"expired_at"`
}

type UserGroupModelDetailResponse struct {
	Model              string                        `json:"model"`
	Price              model.Price                   `json:"price,omitempty"`
	ImagePrices        map[string]float64            `json:"image_prices,omitempty"`
	ImageQualityPrices map[string]map[string]float64 `json:"image_quality_prices,omitempty"`
	Health             model.GroupModelHealthMetric  `json:"health,omitempty"`
}

type UserGroupOptionResponse struct {
	Group           string                          `json:"group"`
	Description     string                          `json:"description,omitempty"`
	PriceMultiplier float64                         `json:"price_multiplier"`
	AvailableSets   []string                        `json:"available_sets"`
	Models          []string                        `json:"models"`
	ModelDetails    []*UserGroupModelDetailResponse `json:"model_details,omitempty"`
}

func buildUserGroupOptionResponses(groups []*model.Group) ([]*UserGroupOptionResponse, error) {
	responses := make([]*UserGroupOptionResponse, 0, len(groups))
	for _, group := range groups {
		option, err := buildUserGroupOptionResponse(group.ID)
		if err != nil {
			return nil, err
		}

		if len(option.Models) == 0 {
			continue
		}

		responses = append(responses, option)
	}

	return responses, nil
}

func buildUserGroupOptionResponse(groupID string) (*UserGroupOptionResponse, error) {
	groupCache, err := model.CacheGetGroup(groupID)
	if err != nil {
		return nil, err
	}

	models := getGroupAvailableModels(groupCache)
	modelDetails, err := buildUserGroupModelDetails(groupCache, models)
	if err != nil {
		return nil, err
	}

	return &UserGroupOptionResponse{
		Group:           groupID,
		Description:     groupCache.Description,
		PriceMultiplier: groupCache.GetPriceMultiplier(),
		AvailableSets:   groupCache.GetAvailableSets(),
		Models:          models,
		ModelDetails:    modelDetails,
	}, nil
}

func buildUserGroupModelDetails(groupCache *model.GroupCache, models []string) ([]*UserGroupModelDetailResponse, error) {
	if groupCache == nil || len(models) == 0 {
		return nil, nil
	}

	configs, err := model.GetModelConfigsByModels(models)
	if err != nil {
		return nil, err
	}

	configByModel := make(map[string]model.ModelConfig, len(configs))
	for _, config := range configs {
		configByModel[strings.ToLower(config.Model)] = config
	}

	healthMetrics, err := model.GetGroupModelHealthMetrics(groupCache.ID, models)
	if err != nil {
		return nil, err
	}

	healthByModel := make(map[string]model.GroupModelHealthMetric, len(healthMetrics))
	for _, metric := range healthMetrics {
		healthByModel[strings.ToLower(metric.Model)] = metric
	}

	multiplier := groupCache.GetPriceMultiplier()
	modelDetails := make([]*UserGroupModelDetailResponse, 0, len(models))
	for _, modelName := range models {
		config, ok := configByModel[strings.ToLower(modelName)]
		if !ok {
			config = model.NewDefaultModelConfig(modelName)
		}

		if groupModelConfig, ok := getGroupModelConfig(groupCache, modelName); ok {
			config = config.LoadFromGroupModelConfig(groupModelConfig)
		}

		modelDetails = append(modelDetails, &UserGroupModelDetailResponse{
			Model:              modelName,
			Price:              config.Price.ApplyMultiplier(multiplier),
			ImagePrices:        applyPriceMultiplierToImagePrices(config.ImagePrices, multiplier),
			ImageQualityPrices: applyPriceMultiplierToImageQualityPrices(config.ImageQualityPrices, multiplier),
			Health:             healthByModel[strings.ToLower(modelName)],
		})
	}

	return modelDetails, nil
}

func getGroupModelConfig(groupCache *model.GroupCache, modelName string) (model.GroupModelConfig, bool) {
	if groupCache == nil || len(groupCache.ModelConfigs) == 0 {
		return model.GroupModelConfig{}, false
	}

	if groupModelConfig, ok := groupCache.ModelConfigs[modelName]; ok {
		return groupModelConfig, true
	}

	for currentModel, groupModelConfig := range groupCache.ModelConfigs {
		if strings.EqualFold(currentModel, modelName) {
			return groupModelConfig, true
		}
	}

	return model.GroupModelConfig{}, false
}

func applyPriceMultiplierToImagePrices(imagePrices map[string]float64, multiplier float64) map[string]float64 {
	if len(imagePrices) == 0 {
		return nil
	}

	scaled := make(map[string]float64, len(imagePrices))
	for size, price := range imagePrices {
		scaled[size] = price * multiplier
	}

	return scaled
}

func applyPriceMultiplierToImageQualityPrices(imageQualityPrices map[string]map[string]float64, multiplier float64) map[string]map[string]float64 {
	if len(imageQualityPrices) == 0 {
		return nil
	}

	scaled := make(map[string]map[string]float64, len(imageQualityPrices))
	for size, qualityPrices := range imageQualityPrices {
		if len(qualityPrices) == 0 {
			continue
		}

		scaled[size] = applyPriceMultiplierToImagePrices(qualityPrices, multiplier)
	}

	return scaled
}

func getGroupAvailableModels(groupCache *model.GroupCache) []string {
	if groupCache == nil {
		return nil
	}

	enabledModelsBySet := model.LoadModelCaches().EnabledModelsBySet
	models := make([]string, 0)
	seen := make(map[string]struct{})

	for _, set := range groupCache.GetAvailableSets() {
		for _, modelName := range enabledModelsBySet[set] {
			key := strings.ToLower(modelName)
			if _, ok := seen[key]; ok {
				continue
			}

			seen[key] = struct{}{}
			models = append(models, modelName)
		}
	}

	return models
}

func normalizeRequestedGroupModels(requestedModels, availableModels []string) ([]string, error) {
	if len(requestedModels) == 0 {
		return nil, nil
	}

	normalized := make([]string, 0, len(requestedModels))
	seen := make(map[string]struct{})

	for _, requestedModel := range requestedModels {
		requestedModel = strings.TrimSpace(requestedModel)
		if requestedModel == "" {
			continue
		}

		actualModel := ""
		for _, availableModel := range availableModels {
			if strings.EqualFold(availableModel, requestedModel) {
				actualModel = availableModel
				break
			}
		}

		if actualModel == "" {
			return nil, fmt.Errorf("model %s is not available in the selected group", requestedModel)
		}

		key := strings.ToLower(actualModel)
		if _, ok := seen[key]; ok {
			continue
		}

		seen[key] = struct{}{}
		normalized = append(normalized, actualModel)
	}

	return normalized, nil
}

func GetCurrentUserGroups(c *gin.Context) {
	groups, err := model.GetEnabledGroups()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	groupOptions, err := buildUserGroupOptionResponses(groups)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"groups": groupOptions,
	})
}

func GetCurrentUserKeys(c *gin.Context) {
	user := middleware.GetWalletUser(c)
	page, perPage := utils.ParsePageParams(c)
	order := c.DefaultQuery("order", "")
	group := c.Query("group")
	status, _ := strconv.Atoi(c.Query("status"))

	tokens, total, err := model.GetAppUserTokens(user.ID, group, page, perPage, order, status)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"keys":  buildTokenResponses(tokens),
		"total": total,
	})
}

func CreateCurrentUserKey(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	req := CreateAppUserKeyRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	if req.Group == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "group is required")
		return
	}

	if req.Name == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if req.Quota < 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "quota must be greater than or equal to 0")
		return
	}
	if req.ExpiredAt < 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "expired_at is invalid")
		return
	}

	if err := validateSubnets(req.Subnets); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "parameter error: "+err.Error())
		return
	}

	groupOption, err := buildUserGroupOptionResponse(req.Group)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	if len(groupOption.Models) == 0 {
		middleware.ErrorResponse(c, http.StatusForbidden, "selected group has no available models")
		return
	}

	req.Models, err = normalizeRequestedGroupModels(req.Models, groupOption.Models)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	token := &model.Token{
		Name:    model.EmptyNullString(req.Name),
		GroupID: req.Group,
		Subnets: req.Subnets,
		Models:  req.Models,
		Quota:   req.Quota,
		Status:  model.TokenStatusEnabled,
	}
	if req.ExpiredAt > 0 {
		token.ExpiredAt = time.UnixMilli(req.ExpiredAt)
	}

	if err := model.CreateAppUserToken(user.ID, token); err != nil {
		switch {
		case errors.Is(err, model.ErrGroupUnavailable):
			middleware.ErrorResponse(c, http.StatusForbidden, err.Error())
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	middleware.SuccessResponse(c, buildTokenResponse(token))
}

func DeleteCurrentUserKey(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid key id")
		return
	}

	if err := model.DeleteAppUserTokenByID(user.ID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

func UpdateCurrentUserKey(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid key id")
		return
	}

	req := UpdateAppUserKeyRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	req.Group = strings.TrimSpace(req.Group)
	if req.Group == "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, "group is required")
		return
	}
	if req.Quota != nil && *req.Quota < 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "quota must be greater than or equal to 0")
		return
	}
	if req.ExpiredAt != nil && *req.ExpiredAt < 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "expired_at is invalid")
		return
	}

	if _, err := model.GetAppUserTokenByID(user.ID, id); err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	groupOption, err := buildUserGroupOptionResponse(req.Group)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	if len(groupOption.Models) == 0 {
		middleware.ErrorResponse(c, http.StatusForbidden, "selected group has no available models")
		return
	}

	req.Models, err = normalizeRequestedGroupModels(req.Models, groupOption.Models)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	token, err := model.UpdateAppUserTokenByID(user.ID, id, model.UpdateAppUserTokenRequest{
		GroupID:   req.Group,
		Models:    &req.Models,
		Quota:     req.Quota,
		ExpiredAt: req.ExpiredAt,
	})
	if err != nil {
		switch {
		case errors.Is(err, model.ErrGroupUnavailable):
			middleware.ErrorResponse(c, http.StatusForbidden, err.Error())
		case errors.Is(err, gorm.ErrRecordNotFound):
			middleware.ErrorResponse(c, http.StatusNotFound, err.Error())
		default:
			middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		}

		return
	}

	middleware.SuccessResponse(c, buildTokenResponse(token))
}
