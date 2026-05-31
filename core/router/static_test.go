package router_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common/config"
	corerouter "github.com/labring/aiproxy/core/router"
	"github.com/smartystreets/goconvey/convey"
)

const testGitHubProjectURL = "https://github.com/labring/aiproxy"

func TestSetStaticFileRouter_DisableWebRoot(t *testing.T) {
	convey.Convey("SetStaticFileRouter with DISABLE_WEB_ROOT", t, func() {
		webPath := writeTestWebFiles(t)
		router := newTestStaticRouter(t, webPath, false, true)

		convey.Convey("should redirect root path to github", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/", nil)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusOK)
			convey.So(recorder.Body.String(), convey.ShouldContainSubstring, testGitHubProjectURL)
			convey.So(
				recorder.Body.String(),
				convey.ShouldContainSubstring,
				"id=\"countdown\">15</div>",
			)
		})

		convey.Convey("should keep static assets accessible", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				"/assets/app.js",
				nil,
			)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusOK)
			convey.So(recorder.Body.String(), convey.ShouldContainSubstring, "console.log('ok');")
			convey.So(
				recorder.Header().Get("Cache-Control"),
				convey.ShouldEqual,
				"public, max-age=31536000, immutable",
			)
		})

		convey.Convey("should not fallback missing hashed assets to SPA index", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				"/assets/missing.js",
				nil,
			)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusNotFound)
			convey.So(recorder.Body.String(), convey.ShouldNotContainSubstring, "test-spa")
		})

		convey.Convey("should keep SPA fallback accessible", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				"/dashboard",
				nil,
			)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusOK)
			convey.So(recorder.Body.String(), convey.ShouldContainSubstring, "test-spa")
			convey.So(
				recorder.Header().Get("Cache-Control"),
				convey.ShouldEqual,
				"no-cache, must-revalidate",
			)
		})

		convey.Convey("should inject public models SEO metadata into SPA fallback", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				"/models",
				nil,
			)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusOK)
			convey.So(
				recorder.Body.String(),
				convey.ShouldContainSubstring,
				"<title>AI Model Catalog | LiteMHub</title>",
			)
			convey.So(
				recorder.Body.String(),
				convey.ShouldContainSubstring,
				"Browse AI models, providers, capabilities",
			)
		})

		convey.Convey("should inject public model detail SEO metadata into SPA fallback", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				"/models/openai/gpt-4o-mini",
				nil,
			)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusOK)
			convey.So(
				recorder.Body.String(),
				convey.ShouldContainSubstring,
				"<title>openai/gpt-4o-mini API Pricing, Context, and Capabilities | LiteMHub</title>",
			)
			convey.So(
				recorder.Body.String(),
				convey.ShouldContainSubstring,
				"Explore openai/gpt-4o-mini on LiteMHub",
			)
		})
	})
}

func TestSetStaticFileRouter_DisableWeb(t *testing.T) {
	convey.Convey("SetStaticFileRouter with DISABLE_WEB", t, func() {
		webPath := writeTestWebFiles(t)
		router := newTestStaticRouter(t, webPath, true, false)

		convey.Convey("should serve the github redirect page on root", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/", nil)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusOK)
			convey.So(recorder.Body.String(), convey.ShouldContainSubstring, testGitHubProjectURL)
		})

		convey.Convey("should not expose static assets", func() {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				context.Background(),
				http.MethodGet,
				"/assets/app.js",
				nil,
			)

			router.ServeHTTP(recorder, req)

			convey.So(recorder.Code, convey.ShouldEqual, http.StatusNotFound)
		})
	})
}

func newTestStaticRouter(
	t *testing.T,
	webPath string,
	disableWeb, disableWebRoot bool,
) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)

	oldWebPath := config.WebPath
	oldDisableWeb := config.DisableWeb
	oldDisableWebRoot := config.DisableWebRoot

	t.Cleanup(func() {
		config.WebPath = oldWebPath
		config.DisableWeb = oldDisableWeb
		config.DisableWebRoot = oldDisableWebRoot
	})

	config.WebPath = webPath
	config.DisableWeb = disableWeb
	config.DisableWebRoot = disableWebRoot

	router := gin.New()
	corerouter.SetStaticFileRouter(router)

	return router
}

func writeTestWebFiles(t *testing.T) string {
	t.Helper()

	webPath := t.TempDir()
	assetsPath := filepath.Join(webPath, "assets")

	if err := os.MkdirAll(assetsPath, 0o755); err != nil {
		t.Fatalf("mkdir assets: %v", err)
	}

	if err := os.WriteFile(
		filepath.Join(webPath, "index.html"),
		[]byte(`<!doctype html><html><head><title>AI Proxy</title><meta name="description" content="AI Proxy"><meta property="og:title" content="AI Proxy" /><meta property="og:description" content="AI Proxy" /></head><body>test-spa</body></html>`),
		0o600,
	); err != nil {
		t.Fatalf("write index.html: %v", err)
	}

	if err := os.WriteFile(
		filepath.Join(assetsPath, "app.js"),
		[]byte("console.log('ok');"),
		0o600,
	); err != nil {
		t.Fatalf("write app.js: %v", err)
	}

	return webPath
}
