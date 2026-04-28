package config

import (
	"os"
	"strings"

	"github.com/labring/aiproxy/core/common/env"
)

var (
	DebugEnabled         bool
	DebugSQLEnabled      bool
	DisableAutoMigrateDB bool
	AdminKey             string
	UserJWTSecret        string
	UserJWTExpireHours   int64
	WebPath              string
	DisableWeb           bool
	DisableWebRoot       bool
	FfmpegEnabled        bool
	InternalToken        string
	DisableModelConfig   bool
	Redis                string
	RedisKeyPrefix       string
	ConfigFilePath       string
	DuluPayAPIBaseURL    string
	DuluPayPID           string
	DuluPayPrivateKey    string
	DuluPayPublicKey     string
	DuluPayNotifyURL     string
	DuluPayReturnURL     string
	DuluPayMethod        string
	DuluPayType          string
	DuluPayDevice        string
	DuluPayProductName   string
	DuluPayMinAmount     float64
	DuluPayMaxAmount     float64

	// OnCall Lark configuration for urgent alerts
	OnCallLarkAppID     string
	OnCallLarkAppSecret string
	OnCallLarkOpenIDs   []string // comma-separated open IDs
)

func ReloadEnv() {
	DebugEnabled = env.Bool("DEBUG", false)
	DebugSQLEnabled = env.Bool("DEBUG_SQL", false)
	DisableAutoMigrateDB = env.Bool("DISABLE_AUTO_MIGRATE_DB", false)
	AdminKey = os.Getenv("ADMIN_KEY")
	UserJWTSecret = os.Getenv("USER_JWT_SECRET")
	UserJWTExpireHours = env.Int64("USER_JWT_EXPIRE_HOURS", 72)
	if UserJWTExpireHours <= 0 {
		UserJWTExpireHours = 72
	}
	WebPath = os.Getenv("WEB_PATH")
	DisableWeb = env.Bool("DISABLE_WEB", false)
	DisableWebRoot = env.Bool("DISABLE_WEB_ROOT", false)
	FfmpegEnabled = env.Bool("FFMPEG_ENABLED", false)
	InternalToken = os.Getenv("INTERNAL_TOKEN")
	DisableModelConfig = env.Bool("DISABLE_MODEL_CONFIG", false)
	Redis = env.String("REDIS", os.Getenv("REDIS_CONN_STRING"))
	RedisKeyPrefix = os.Getenv("REDIS_KEY_PREFIX")
	ConfigFilePath = env.String("CONFIG_FILE_PATH", "./config.yaml")
	DuluPayAPIBaseURL = strings.TrimRight(
		env.String("DULUPAY_API_BASE_URL", "https://api.dulupay.com"),
		"/",
	)
	DuluPayPID = os.Getenv("DULUPAY_PID")
	DuluPayPrivateKey = os.Getenv("DULUPAY_PRIVATE_KEY")
	DuluPayPublicKey = os.Getenv("DULUPAY_PUBLIC_KEY")
	DuluPayNotifyURL = os.Getenv("DULUPAY_NOTIFY_URL")
	DuluPayReturnURL = os.Getenv("DULUPAY_RETURN_URL")
	DuluPayMethod = env.String("DULUPAY_METHOD", "jump")
	DuluPayType = env.String("DULUPAY_TYPE", "alipay")
	DuluPayDevice = env.String("DULUPAY_DEVICE", "pc")
	DuluPayProductName = env.String("DULUPAY_PRODUCT_NAME", "LiteMHub Wallet Recharge")
	DuluPayMinAmount = env.Float64("DULUPAY_MIN_AMOUNT", 1)
	DuluPayMaxAmount = env.Float64("DULUPAY_MAX_AMOUNT", 50000)

	// OnCall Lark configuration
	OnCallLarkAppID = os.Getenv("ON_CALL_LARK_APP_ID")
	OnCallLarkAppSecret = os.Getenv("ON_CALL_LARK_APP_SECRET")
	OnCallLarkOpenIDs = parseOpenIDs(os.Getenv("ON_CALL_LARK_OPEN_ID"))
}

// parseOpenIDs parses comma-separated open IDs
func parseOpenIDs(s string) []string {
	if s == "" {
		return nil
	}

	parts := strings.Split(s, ",")

	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}

	return result
}

func GetUserJWTSecret() string {
	if UserJWTSecret != "" {
		return UserJWTSecret
	}

	if AdminKey != "" {
		return AdminKey
	}

	if InternalToken != "" {
		return InternalToken
	}

	return ""
}

func init() {
	ReloadEnv()
}
