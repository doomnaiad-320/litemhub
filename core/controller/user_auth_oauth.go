package controller

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

const (
	userOAuthGitHub          = "github"
	userOAuthGoogle          = "google"
	userOAuthStateTTL        = 10 * time.Minute
	userOAuthCallbackPrefix  = "/user-api/auth/oauth/"
	userOAuthStateCookieBase = "user_oauth_state_"
)

var (
	errUserOAuthProviderUnsupported = errors.New("unsupported oauth provider")
	errUserOAuthProviderNotReady    = errors.New("oauth provider is not configured")
)

type userOAuthState struct {
	State          string `json:"state"`
	FrontendOrigin string `json:"frontend_origin"`
}

type userOAuthLoginPayload struct {
	Token     string           `json:"token"`
	ExpiresAt int64            `json:"expires_at"`
	User      *AppUserResponse `json:"user"`
}

type userOAuthProfile struct {
	Email         string
	EmailVerified bool
	Name          string
	AvatarURL     string
}

type userOAuthGitHubUser struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	Login     string `json:"login"`
}

type userOAuthGitHubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

type userOAuthGoogleProfile struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func StartUserOAuthLogin(c *gin.Context) {
	provider := normalizeUserOAuthProvider(c.Param("provider"))
	frontendOrigin := captureUserOAuthFrontendOrigin(c.Request)
	callbackURL, err := buildUserOAuthCallbackURL(c.Request, provider)
	if err != nil {
		redirectUserOAuthError(c, frontendOrigin, "第三方登录暂时不可用")
		return
	}

	oauthConfig, err := buildUserOAuthConfig(provider, callbackURL)
	if err != nil {
		redirectUserOAuthError(c, frontendOrigin, userOAuthProviderErrorMessage(provider))
		return
	}

	state, err := generateUserOAuthState()
	if err != nil {
		redirectUserOAuthError(c, frontendOrigin, "第三方登录暂时不可用")
		return
	}

	if err := setUserOAuthStateCookie(c, provider, state, frontendOrigin); err != nil {
		redirectUserOAuthError(c, frontendOrigin, "第三方登录暂时不可用")
		return
	}

	c.Redirect(http.StatusFound, oauthConfig.AuthCodeURL(state))
}

func HandleUserOAuthCallback(c *gin.Context) {
	provider := normalizeUserOAuthProvider(c.Param("provider"))
	stateCookie, err := c.Cookie(userOAuthStateCookieName(provider))
	if err != nil {
		redirectUserOAuthError(c, captureUserOAuthFrontendOrigin(c.Request), "登录会话已失效，请重试")
		return
	}

	statePayload, err := decodeUserOAuthState(stateCookie)
	clearUserOAuthStateCookie(c, provider)
	if err != nil || statePayload == nil || statePayload.State == "" {
		redirectUserOAuthError(c, captureUserOAuthFrontendOrigin(c.Request), "登录会话已失效，请重试")
		return
	}

	if c.Query("state") == "" || c.Query("state") != statePayload.State {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "登录会话已失效，请重试")
		return
	}

	if errMsg := strings.TrimSpace(c.Query("error")); errMsg != "" {
		message := strings.TrimSpace(c.Query("error_description"))
		if message == "" {
			message = "第三方登录已取消"
		}
		redirectUserOAuthError(c, statePayload.FrontendOrigin, message)
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "登录会话已失效，请重试")
		return
	}

	callbackURL, err := buildUserOAuthCallbackURL(c.Request, provider)
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "第三方登录暂时不可用")
		return
	}

	oauthConfig, err := buildUserOAuthConfig(provider, callbackURL)
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, userOAuthProviderErrorMessage(provider))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	token, err := oauthConfig.Exchange(ctx, code)
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "第三方登录失败，请重试")
		return
	}

	profile, err := fetchUserOAuthProfile(ctx, provider, oauthConfig, token)
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "无法获取第三方账号信息")
		return
	}

	email := normalizeUserPortalEmail(profile.Email)
	if email == "" || !profile.EmailVerified {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "无法获取已验证的邮箱地址")
		return
	}

	user, err := getOrCreateUserByEmailForOAuth(email)
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "账号登录失败，请重试")
		return
	}

	if user.Status != model.AppUserStatusEnabled {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "用户已被禁用")
		return
	}

	accessToken, expiresAt, err := middleware.CreateUserJWT(user)
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "登录失败，请重试")
		return
	}

	payload, err := json.Marshal(userOAuthLoginPayload{
		Token:     accessToken,
		ExpiresAt: expiresAt.UnixMilli(),
		User:      buildAppUserResponse(user),
	})
	if err != nil {
		redirectUserOAuthError(c, statePayload.FrontendOrigin, "登录失败，请重试")
		return
	}

	redirectURL := buildUserOAuthLoginRedirectURL(statePayload.FrontendOrigin, string(payload))
	c.Redirect(http.StatusFound, redirectURL)
}

func normalizeUserOAuthProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

func userOAuthProviderErrorMessage(provider string) string {
	switch provider {
	case userOAuthGitHub:
		return "GitHub 登录未配置"
	case userOAuthGoogle:
		return "Google 登录未配置"
	default:
		return "第三方登录未配置"
	}
}

func buildUserOAuthConfig(provider, redirectURL string) (*oauth2.Config, error) {
	switch provider {
	case userOAuthGitHub:
		if strings.TrimSpace(config.UserOAuthGitHubClientID) == "" || strings.TrimSpace(config.UserOAuthGitHubClientSecret) == "" {
			return nil, errUserOAuthProviderNotReady
		}

		return &oauth2.Config{
			ClientID:     strings.TrimSpace(config.UserOAuthGitHubClientID),
			ClientSecret: strings.TrimSpace(config.UserOAuthGitHubClientSecret),
			RedirectURL:  redirectURL,
			Scopes:       []string{"read:user", "user:email"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://github.com/login/oauth/authorize",
				TokenURL: "https://github.com/login/oauth/access_token",
			},
		}, nil
	case userOAuthGoogle:
		if strings.TrimSpace(config.UserOAuthGoogleClientID) == "" || strings.TrimSpace(config.UserOAuthGoogleClientSecret) == "" {
			return nil, errUserOAuthProviderNotReady
		}

		return &oauth2.Config{
			ClientID:     strings.TrimSpace(config.UserOAuthGoogleClientID),
			ClientSecret: strings.TrimSpace(config.UserOAuthGoogleClientSecret),
			RedirectURL:  redirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL: "https://oauth2.googleapis.com/token",
			},
		}, nil
	default:
		return nil, errUserOAuthProviderUnsupported
	}
}

func buildUserOAuthCallbackURL(req *http.Request, provider string) (string, error) {
	provider = normalizeUserOAuthProvider(provider)
	if provider != userOAuthGitHub && provider != userOAuthGoogle {
		return "", errUserOAuthProviderUnsupported
	}

	baseURL := strings.TrimSpace(config.UserOAuthCallbackBaseURL)
	if baseURL == "" {
		baseURL = buildRequestBaseURL(req)
	}

	baseURL = strings.TrimRight(baseURL, "/")
	if baseURL == "" {
		return "", errors.New("callback base url is empty")
	}

	return baseURL + userOAuthCallbackPrefix + provider + "/callback", nil
}

func buildRequestBaseURL(req *http.Request) string {
	if req == nil {
		return ""
	}

	host := forwardedHeaderValue(req.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(req.Host)
	}

	if host == "" {
		return ""
	}

	scheme := forwardedHeaderValue(req.Header.Get("X-Forwarded-Proto"))
	if scheme == "" {
		if req.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}

	return scheme + "://" + host
}

func forwardedHeaderValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	if idx := strings.IndexByte(value, ','); idx >= 0 {
		value = value[:idx]
	}

	return strings.TrimSpace(value)
}

func captureUserOAuthFrontendOrigin(req *http.Request) string {
	if origin := normalizeAbsoluteOrigin(config.UserOAuthFrontendBaseURL); origin != "" {
		return origin
	}

	return buildRequestBaseURL(req)
}

func normalizeAbsoluteOrigin(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}

	if parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}

	return parsed.Scheme + "://" + parsed.Host
}

func generateUserOAuthState() (string, error) {
	state := make([]byte, 32)
	if _, err := rand.Read(state); err != nil {
		return "", fmt.Errorf("failed to generate oauth state: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(state), nil
}

func userOAuthStateCookieName(provider string) string {
	return userOAuthStateCookieBase + provider
}

func userOAuthStateCookiePath(provider string) string {
	return userOAuthCallbackPrefix + provider
}

func setUserOAuthStateCookie(c *gin.Context, provider, state, frontendOrigin string) error {
	if c == nil {
		return errors.New("gin context is nil")
	}

	payload, err := json.Marshal(userOAuthState{
		State:          state,
		FrontendOrigin: frontendOrigin,
	})
	if err != nil {
		return err
	}

	cookie := &http.Cookie{
		Name:     userOAuthStateCookieName(provider),
		Value:    base64.RawURLEncoding.EncodeToString(payload),
		Path:     userOAuthStateCookiePath(provider),
		MaxAge:   int(userOAuthStateTTL.Seconds()),
		HttpOnly: true,
		Secure:   shouldUseSecureCookie(c.Request),
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(c.Writer, cookie)

	return nil
}

func clearUserOAuthStateCookie(c *gin.Context, provider string) {
	if c == nil {
		return
	}

	cookie := &http.Cookie{
		Name:     userOAuthStateCookieName(provider),
		Value:    "",
		Path:     userOAuthStateCookiePath(provider),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   shouldUseSecureCookie(c.Request),
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(c.Writer, cookie)
}

func decodeUserOAuthState(value string) (*userOAuthState, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, errors.New("oauth state is empty")
	}

	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, err
	}

	state := &userOAuthState{}
	if err := json.Unmarshal(raw, state); err != nil {
		return nil, err
	}

	state.FrontendOrigin = normalizeAbsoluteOrigin(state.FrontendOrigin)
	return state, nil
}

func shouldUseSecureCookie(req *http.Request) bool {
	if req == nil {
		return false
	}

	scheme := forwardedHeaderValue(req.Header.Get("X-Forwarded-Proto"))
	if scheme != "" {
		return strings.EqualFold(scheme, "https")
	}

	return req.TLS != nil
}

func buildUserOAuthLoginRedirectURL(frontendOrigin, payload string) string {
	frontendOrigin = strings.TrimRight(strings.TrimSpace(frontendOrigin), "/")
	if frontendOrigin == "" {
		return "/login#oauth=" + url.QueryEscape(payload)
	}

	return frontendOrigin + "/login#oauth=" + url.QueryEscape(payload)
}

func redirectUserOAuthError(c *gin.Context, frontendOrigin, message string) {
	frontendOrigin = strings.TrimSpace(frontendOrigin)
	if frontendOrigin == "" {
		frontendOrigin = buildRequestBaseURL(c.Request)
	}

	redirectURL := strings.TrimRight(frontendOrigin, "/") + "/login#oauth_error=" + url.QueryEscape(strings.TrimSpace(message))
	c.Redirect(http.StatusFound, redirectURL)
}

func getOrCreateUserByEmailForOAuth(email string) (*model.AppUser, error) {
	email = normalizeUserPortalEmail(email)
	if email == "" {
		return nil, errors.New("email is empty")
	}

	user, err := model.GetAppUserByEmail(email)
	if err == nil {
		return user, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	passwordHash, err := generateOAuthPasswordHash()
	if err != nil {
		return nil, err
	}

	user = &model.AppUser{
		Email:        model.EmptyNullString(email),
		PasswordHash: passwordHash,
		Status:       model.AppUserStatusEnabled,
	}

	if err := model.CreateAppUserWithWallet(user); err != nil {
		if errors.Is(err, model.ErrAppUserAlreadyExists) {
			return model.GetAppUserByEmail(email)
		}

		return nil, err
	}

	return user, nil
}

func generateOAuthPasswordHash() (string, error) {
	seed := make([]byte, 32)
	if _, err := rand.Read(seed); err != nil {
		return "", fmt.Errorf("failed to generate oauth password seed: %w", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword(seed, bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash oauth password: %w", err)
	}

	return string(passwordHash), nil
}

func fetchUserOAuthProfile(ctx context.Context, provider string, oauthConfig *oauth2.Config, token *oauth2.Token) (*userOAuthProfile, error) {
	switch provider {
	case userOAuthGitHub:
		return fetchUserOAuthGitHubProfile(ctx, oauthConfig, token)
	case userOAuthGoogle:
		return fetchUserOAuthGoogleProfile(ctx, oauthConfig, token)
	default:
		return nil, errUserOAuthProviderUnsupported
	}
}

func fetchUserOAuthGitHubProfile(ctx context.Context, oauthConfig *oauth2.Config, token *oauth2.Token) (*userOAuthProfile, error) {
	client := oauthConfig.Client(ctx, token)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "aiproxy-user-portal")

	githubUser := userOAuthGitHubUser{}
	if err := doJSONRequest(client, req, &githubUser); err != nil {
		return nil, err
	}

	emailsReq, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	if err != nil {
		return nil, err
	}
	emailsReq.Header.Set("Accept", "application/vnd.github+json")
	emailsReq.Header.Set("User-Agent", "aiproxy-user-portal")

	var emails []userOAuthGitHubEmail
	if err := doJSONRequest(client, emailsReq, &emails); err != nil {
		return nil, err
	}

	email, emailVerified := selectGitHubEmail(emails)
	if email == "" {
		return nil, errors.New("no verified github email found")
	}

	return &userOAuthProfile{
		Email:         email,
		EmailVerified: emailVerified,
		Name:          strings.TrimSpace(githubUser.Name),
		AvatarURL:     strings.TrimSpace(githubUser.AvatarURL),
	}, nil
}

func selectGitHubEmail(emails []userOAuthGitHubEmail) (string, bool) {
	var fallback string

	for _, email := range emails {
		normalized := strings.TrimSpace(email.Email)
		if normalized == "" || !email.Verified {
			continue
		}

		if email.Primary {
			return normalized, true
		}

		if fallback == "" {
			fallback = normalized
		}
	}

	return fallback, fallback != ""
}

func fetchUserOAuthGoogleProfile(ctx context.Context, oauthConfig *oauth2.Config, token *oauth2.Token) (*userOAuthProfile, error) {
	client := oauthConfig.Client(ctx, token)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		return nil, err
	}

	googleProfile := userOAuthGoogleProfile{}
	if err := doJSONRequest(client, req, &googleProfile); err != nil {
		return nil, err
	}

	return &userOAuthProfile{
		Email:         strings.TrimSpace(googleProfile.Email),
		EmailVerified: googleProfile.EmailVerified,
		Name:          strings.TrimSpace(googleProfile.Name),
		AvatarURL:     strings.TrimSpace(googleProfile.Picture),
	}, nil
}

func doJSONRequest(client *http.Client, req *http.Request, dst any) error {
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("oauth provider request failed: %s", strings.TrimSpace(string(body)))
	}

	return json.NewDecoder(resp.Body).Decode(dst)
}
