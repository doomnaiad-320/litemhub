package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller/utils"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"gorm.io/gorm"
)

type LineRouteRequest struct {
	APIURL      string `json:"api_url"`
	Description string `json:"description"`
	Note        string `json:"note"`
}

type LineRouteResponse struct {
	ID          int    `json:"id"`
	APIURL      string `json:"api_url"`
	Description string `json:"description"`
	Note        string `json:"note,omitempty"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

func GetLineRoutes(c *gin.Context) {
	page, perPage := utils.ParsePageParams(c)
	keyword := c.Query("keyword")

	lineRoutes, total, err := model.GetLineRoutes(keyword, page, perPage)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"line_routes": buildLineRouteResponses(lineRoutes),
		"total":       total,
	})
}

func GetCurrentUserLineRoutes(c *gin.Context) {
	lineRoutes, err := model.GetAllLineRoutes()
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"line_routes": buildLineRouteResponses(lineRoutes),
	})
}

func CreateLineRoute(c *gin.Context) {
	req := LineRouteRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	lineRoute, err := buildLineRouteFromRequest(req)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	if err = model.CreateLineRoute(lineRoute); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"line_route": buildLineRouteResponse(lineRoute),
	})
}

func UpdateLineRoute(c *gin.Context) {
	lineRoute, ok := getLineRouteFromParam(c)
	if !ok {
		return
	}

	req := LineRouteRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	updated, err := buildLineRouteFromRequest(req)
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	lineRoute.APIURL = updated.APIURL
	lineRoute.Description = updated.Description
	lineRoute.Note = updated.Note

	if err = model.UpdateLineRoute(lineRoute); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"line_route": buildLineRouteResponse(lineRoute),
	})
}

func DeleteLineRoute(c *gin.Context) {
	id, ok := parseLineRouteID(c)
	if !ok {
		return
	}

	if err := model.DeleteLineRoute(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "line route not found")
			return
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, nil)
}

func buildLineRouteFromRequest(req LineRouteRequest) (*model.LineRoute, error) {
	apiURL := strings.TrimSpace(req.APIURL)
	description := strings.TrimSpace(req.Description)
	note := strings.TrimSpace(req.Note)

	if apiURL == "" {
		return nil, errors.New("api address is required")
	}
	if description == "" {
		return nil, errors.New("line description is required")
	}

	return &model.LineRoute{
		APIURL:      apiURL,
		Description: description,
		Note:        note,
	}, nil
}

func buildLineRouteResponses(lineRoutes []*model.LineRoute) []LineRouteResponse {
	responses := make([]LineRouteResponse, 0, len(lineRoutes))
	for _, lineRoute := range lineRoutes {
		responses = append(responses, buildLineRouteResponse(lineRoute))
	}

	return responses
}

func buildLineRouteResponse(lineRoute *model.LineRoute) LineRouteResponse {
	if lineRoute == nil {
		return LineRouteResponse{}
	}

	return LineRouteResponse{
		ID:          lineRoute.ID,
		APIURL:      lineRoute.APIURL,
		Description: lineRoute.Description,
		Note:        lineRoute.Note,
		CreatedAt:   lineRoute.CreatedAt.UnixMilli(),
		UpdatedAt:   lineRoute.UpdatedAt.UnixMilli(),
	}
}

func getLineRouteFromParam(c *gin.Context) (*model.LineRoute, bool) {
	id, ok := parseLineRouteID(c)
	if !ok {
		return nil, false
	}

	lineRoute, err := model.GetLineRouteByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			middleware.ErrorResponse(c, http.StatusNotFound, "line route not found")
			return nil, false
		}

		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return nil, false
	}

	return lineRoute, true
}

func parseLineRouteID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid line route id")
		return 0, false
	}

	return id, true
}
