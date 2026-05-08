package controller

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"github.com/labring/aiproxy/core/relay/mode"
)

const (
	playgroundGroupHeader = "X-Playground-Group"
	playgroundTokenName   = "playground"
)

func UserPlaygroundChat() []gin.HandlerFunc {
	return []gin.HandlerFunc{
		prepareUserPlaygroundChat,
		middleware.NewDistribute(mode.ChatCompletions),
		NewRelay(mode.ChatCompletions),
	}
}

func prepareUserPlaygroundChat(c *gin.Context) {
	user := middleware.GetWalletUser(c)
	if user == nil || user.ID == 0 {
		middleware.AbortLogWithMessageWithMode(
			mode.ChatCompletions,
			c,
			http.StatusUnauthorized,
			"unauthorized, user not found",
		)
		return
	}

	body, err := common.GetRequestBodyReusable(c.Request)
	if err != nil {
		middleware.AbortLogWithMessageWithMode(
			mode.ChatCompletions,
			c,
			http.StatusBadRequest,
			err.Error(),
		)
		return
	}

	requestModel, err := middleware.GetModelFromJSON(body)
	if err != nil {
		middleware.AbortLogWithMessageWithMode(
			mode.ChatCompletions,
			c,
			http.StatusBadRequest,
			err.Error(),
		)
		return
	}

	requestModel = strings.TrimSpace(requestModel)
	if requestModel == "" {
		middleware.AbortLogWithMessageWithMode(
			mode.ChatCompletions,
			c,
			http.StatusBadRequest,
			"model is required",
		)
		return
	}

	group, actualModel, err := resolvePlaygroundGroup(c, requestModel)
	if err != nil {
		middleware.AbortLogWithMessageWithMode(
			mode.ChatCompletions,
			c,
			http.StatusForbidden,
			err.Error(),
		)
		return
	}

	modelCaches := model.LoadModelCaches()
	token := model.TokenCache{
		Group:       group.ID,
		Key:         fmt.Sprintf("playground-user-%d", user.ID),
		Name:        playgroundTokenName,
		Models:      []string{actualModel},
		Status:      model.TokenStatusEnabled,
		OwnerUserID: user.ID,
	}
	token.SetAvailableSets(group.GetAvailableSets())
	token.SetModelsBySet(modelCaches.EnabledModelsBySet)
	if err := token.LoadPriceMultiplierOverride(); err != nil {
		middleware.AbortLogWithMessageWithMode(
			mode.ChatCompletions,
			c,
			http.StatusInternalServerError,
			err.Error(),
		)
		return
	}

	c.Header("Group", group.ID)
	middleware.SetLogGroupFields(common.GetLogger(c).Data, group)
	middleware.SetLogTokenFields(common.GetLogger(c).Data, token, false)

	c.Set(middleware.Group, group)
	c.Set(middleware.Token, token)
	c.Set(middleware.ModelCaches, modelCaches)
	c.Set(middleware.WalletUser, *user)
	c.Next()
}

func resolvePlaygroundGroup(c *gin.Context, requestModel string) (model.GroupCache, string, error) {
	requestedGroup := strings.TrimSpace(c.GetHeader(playgroundGroupHeader))
	if requestedGroup == "" {
		requestedGroup = strings.TrimSpace(c.Query("group"))
	}

	if requestedGroup != "" {
		groupCache, err := model.CacheGetGroup(requestedGroup)
		if err != nil {
			return model.GroupCache{}, "", fmt.Errorf("selected group is not available")
		}

		if groupCache.Status != model.GroupStatusEnabled {
			return model.GroupCache{}, "", fmt.Errorf("selected group is disabled")
		}

		if actualModel := findModelInGroup(groupCache, requestModel); actualModel != "" {
			return *groupCache, actualModel, nil
		}

		return model.GroupCache{}, "", fmt.Errorf("model %s is not available in the selected group", requestModel)
	}

	groups, err := model.GetEnabledGroups()
	if err != nil {
		return model.GroupCache{}, "", err
	}

	for _, group := range groups {
		if group == nil {
			continue
		}

		groupCache, err := model.CacheGetGroup(group.ID)
		if err != nil {
			return model.GroupCache{}, "", err
		}

		if actualModel := findModelInGroup(groupCache, requestModel); actualModel != "" {
			return *groupCache, actualModel, nil
		}
	}

	return model.GroupCache{}, "", fmt.Errorf("model %s is not available for playground", requestModel)
}

func findModelInGroup(groupCache *model.GroupCache, requestModel string) string {
	if groupCache == nil {
		return ""
	}

	modelCaches := model.LoadModelCaches()
	token := model.TokenCache{}
	token.SetAvailableSets(groupCache.GetAvailableSets())
	token.SetModelsBySet(modelCaches.EnabledModelsBySet)

	return token.FindModel(requestModel)
}
