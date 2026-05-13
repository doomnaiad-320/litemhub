package router

import (
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/controller"
	"github.com/labring/aiproxy/core/middleware"
)

func SetUserAPIRouter(router *gin.Engine) {
	userAPI := router.Group("/user-api")
	userAPI.GET("/payments/dulupay/notify", controller.DuluPayNotify)
	userAPI.GET("/payments/dulupay/return", controller.DuluPayReturn)

	authPublicRouter := userAPI.Group("/auth")
	{
		authPublicRouter.POST("/email-code", controller.SendUserRegisterEmailCode)
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
		walletRouter.POST("/recharge/dulupay", controller.CreateDuluPayRecharge)

		logsRouter := protectedUserAPI.Group("/logs")
		logsRouter.GET("", controller.GetCurrentUserModelLogs)
		logsRouter.GET("/detail/:log_id", controller.GetCurrentUserModelLogDetail)

		playgroundRouter := protectedUserAPI.Group("/playground")
		playgroundRouter.POST("/chat", controller.UserPlaygroundChat()...)

		keysRouter := protectedUserAPI.Group("/keys")
		keysRouter.GET("", controller.GetCurrentUserKeys)
		keysRouter.POST("", controller.CreateCurrentUserKey)
		keysRouter.PUT("/:id", controller.UpdateCurrentUserKey)
		keysRouter.DELETE("/:id", controller.DeleteCurrentUserKey)
	}
}
