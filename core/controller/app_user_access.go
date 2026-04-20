package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller/utils"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"gorm.io/gorm"
)

type CreateAppUserKeyRequest struct {
	Group   string   `json:"group"`
	Name    string   `json:"name"`
	Subnets []string `json:"subnets"`
	Models  []string `json:"models"`
}

type UserGroupOptionResponse struct {
	Group           string   `json:"group"`
	PriceMultiplier float64  `json:"price_multiplier"`
	AvailableSets   []string `json:"available_sets"`
	Models          []string `json:"models"`
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

	return &UserGroupOptionResponse{
		Group:           groupID,
		PriceMultiplier: groupCache.GetPriceMultiplier(),
		AvailableSets:   groupCache.GetAvailableSets(),
		Models:          getGroupAvailableModels(groupCache),
	}, nil
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
		Status:  model.TokenStatusEnabled,
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
