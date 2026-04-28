package router_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	corerouter "github.com/labring/aiproxy/core/router"
	"github.com/smartystreets/goconvey/convey"
)

func TestSetPublicAPIRouter_ModelDetailWildcard(t *testing.T) {
	convey.Convey("SetPublicAPIRouter model detail route", t, func() {
		gin.SetMode(gin.TestMode)
		router := gin.New()
		corerouter.SetPublicAPIRouter(router)

		foundWildcardRoute := false
		for _, route := range router.Routes() {
			if route.Method == http.MethodGet && route.Path == "/public-api/models/*model" {
				foundWildcardRoute = true
				break
			}
		}

		convey.So(foundWildcardRoute, convey.ShouldBeTrue)
	})
}
