package router

import (
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller"
)

func SetPublicAPIRouter(router *gin.Engine) {
	publicAPI := router.Group("/public-api")

	modelsRoute := publicAPI.Group("/models")
	{
		modelsRoute.GET("", controller.GetPublicModels)
		modelsRoute.GET("/*model", controller.GetPublicModel)
	}

	announcementsRoute := publicAPI.Group("/announcements")
	{
		announcementsRoute.GET("", controller.GetPublicAnnouncements)
		announcementsRoute.GET("/", controller.GetPublicAnnouncements)
		announcementsRoute.GET("/categories", controller.GetPublicAnnouncementCategories)
	}
}
