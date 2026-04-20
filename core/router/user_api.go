package router

import (
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller"
	"github.com/labring/aiproxy/core/middleware"
)

func SetUserAPIRouter(router *gin.Engine) {
	userAPI := router.Group("/user-api")

	authPublicRouter := userAPI.Group("/auth")
	{
		authPublicRouter.POST("/register", controller.RegisterAppUser)
		authPublicRouter.POST("/login", controller.LoginAppUser)
	}

	protectedUserAPI := userAPI.Group("")
	protectedUserAPI.Use(middleware.UserAuth)
	{
		authPrivateRouter := protectedUserAPI.Group("/auth")
		authPrivateRouter.GET("/me", controller.GetCurrentAppUser)

		protectedUserAPI.GET("/groups", controller.GetCurrentUserGroups)

		walletRouter := protectedUserAPI.Group("/wallet")
		walletRouter.GET("", controller.GetCurrentUserWallet)
		walletRouter.GET("/logs", controller.GetCurrentUserWalletLogs)

		keysRouter := protectedUserAPI.Group("/keys")
		keysRouter.GET("", controller.GetCurrentUserKeys)
		keysRouter.POST("", controller.CreateCurrentUserKey)
		keysRouter.DELETE("/:id", controller.DeleteCurrentUserKey)
	}
}
