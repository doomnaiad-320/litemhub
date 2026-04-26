package router

import (
	"github.com/gin-gonic/gin"
)

func SetRouter(router *gin.Engine) {
	SetAPIRouter(router)
	SetUserAPIRouter(router)
	SetPublicAPIRouter(router)
	SetRelayRouter(router)
	SetMCPRouter(router)
	SetStaticFileRouter(router)
	SetSwaggerRouter(router)
}
