package router

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/public"
	"github.com/sirupsen/logrus"
)

const (
	githubProjectURL              = "https://github.com/labring/aiproxy"
	githubProjectInitialCountdown = 15
	publicModelsTitle             = "AI Model Catalog | LiteMHub"
	publicModelsDescription       = "Browse AI models, providers, capabilities, context windows, and API pricing available through the LiteMHub OpenAI-compatible API."
)

func SetStaticFileRouter(router *gin.Engine) {
	router.SetHTMLTemplate(
		template.Must(
			template.New("").Funcs(router.FuncMap).ParseFS(public.Templates, "templates/*"),
		),
	)

	if config.DisableWeb {
		router.GET("/", renderWebRootRedirectPage)

		return
	}

	if config.WebPath == "" {
		routerFs, ok := public.Public.(fs.ReadDirFS)
		if !ok {
			panic(fmt.Sprintf("public fs type error: %T, %v", public.Public, public.Public))
		}

		err := initFSRouter(router, routerFs, ".")
		if err != nil {
			panic(err)
		}

		registerWebRootRedirect(router)

		fs := http.FS(public.Public)
		router.NoRoute(newIndexNoRouteHandler(fs))
	} else {
		absPath, err := filepath.Abs(config.WebPath)
		if err != nil {
			panic(err)
		}

		logrus.Infof("frontend file path: %s", absPath)

		routerFs, ok := os.DirFS(absPath).(fs.ReadDirFS)
		if !ok {
			panic(fmt.Sprintf("public fs type error: %T, %v", public.Public, public.Public))
		}

		err = initFSRouter(router, routerFs, ".")
		if err != nil {
			panic(err)
		}

		registerWebRootRedirect(router)
		router.NoRoute(newDynamicNoRouteHandler(http.Dir(absPath)))
	}
}

func registerWebRootRedirect(router *gin.Engine) {
	if !config.DisableWebRoot {
		return
	}

	router.GET("/", renderWebRootRedirectPage)
	router.HEAD("/", renderWebRootRedirectPage)
}

func renderWebRootRedirectPage(ctx *gin.Context) {
	ctx.HTML(http.StatusOK, "index.tmpl", gin.H{
		"URL":               githubProjectURL,
		"INITIAL_COUNTDOWN": githubProjectInitialCountdown,
	})
}

func checkNoRouteNotFound(req *http.Request) bool {
	if req.Method != http.MethodGet &&
		req.Method != http.MethodHead {
		return true
	}

	if strings.HasPrefix(req.URL.Path, "/api") ||
		strings.HasPrefix(req.URL.Path, "/public-api") ||
		(strings.HasPrefix(req.URL.Path, "/mcp") && !strings.HasPrefix(req.URL.Path, "/mcp-front")) ||
		strings.HasPrefix(req.URL.Path, "/v1") {
		return true
	}

	return false
}

func newIndexNoRouteHandler(fs http.FileSystem) func(ctx *gin.Context) {
	return func(ctx *gin.Context) {
		if checkNoRouteNotFound(ctx.Request) {
			http.NotFound(ctx.Writer, ctx.Request)
			return
		}

		if tryServeIndexWithPublicModelsMeta(ctx, fs) {
			return
		}

		ctx.FileFromFS("", fs)
	}
}

func newDynamicNoRouteHandler(fs http.FileSystem) func(ctx *gin.Context) {
	fileServer := http.StripPrefix("/", http.FileServer(fs))

	return func(c *gin.Context) {
		if checkNoRouteNotFound(c.Request) {
			http.NotFound(c.Writer, c.Request)
			return
		}

		f, err := fs.Open(c.Request.URL.Path)
		if err != nil {
			if tryServeIndexWithPublicModelsMeta(c, fs) {
				return
			}

			c.FileFromFS("", fs)
			return
		}

		f.Close()

		fileServer.ServeHTTP(c.Writer, c.Request)
	}
}

func tryServeIndexWithPublicModelsMeta(ctx *gin.Context, fs http.FileSystem) bool {
	if ctx.Request.URL.Path != "/models" {
		return false
	}

	index, err := fs.Open("index.html")
	if err != nil {
		return false
	}
	defer index.Close()

	content, err := io.ReadAll(index)
	if err != nil {
		return false
	}

	content = bytes.ReplaceAll(
		content,
		[]byte("<title>AI Proxy</title>"),
		[]byte("<title>"+publicModelsTitle+"</title>"),
	)
	content = bytes.ReplaceAll(
		content,
		[]byte(`content="AI Proxy"`),
		[]byte(`content="`+publicModelsDescription+`"`),
	)
	content = bytes.ReplaceAll(
		content,
		[]byte(`<meta property="og:title" content="AI Proxy" />`),
		[]byte(`<meta property="og:title" content="`+publicModelsTitle+`" />`),
	)
	content = bytes.ReplaceAll(
		content,
		[]byte(`<meta property="og:description" content="AI Proxy" />`),
		[]byte(`<meta property="og:description" content="`+publicModelsDescription+`" />`),
	)

	ctx.Data(http.StatusOK, "text/html; charset=utf-8", content)

	return true
}

type staticFileFS interface {
	StaticFileFS(relativePath, filepath string, fs http.FileSystem) gin.IRoutes
}

func initFSRouter(e staticFileFS, f fs.ReadDirFS, path string) error {
	dirs, err := f.ReadDir(path)
	if err != nil {
		return err
	}

	for _, dir := range dirs {
		u, err := url.JoinPath(path, dir.Name())
		if err != nil {
			return err
		}

		if dir.IsDir() {
			err = initFSRouter(e, f, u)
			if err != nil {
				return err
			}
		} else {
			e.StaticFileFS(u, u, http.FS(f))
		}
	}

	return nil
}
