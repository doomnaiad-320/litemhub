package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/labring/aiproxy/core/common"
	"github.com/labring/aiproxy/core/common/config"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

type RequestDetail struct {
	CreatedAt             time.Time `gorm:"autoCreateTime;index" json:"-"`
	RequestBody           string    `gorm:"type:text"            json:"request_body,omitempty"`
	ResponseBody          string    `gorm:"type:text"            json:"response_body,omitempty"`
	RequestBodyTruncated  bool      `                            json:"request_body_truncated,omitempty"`
	ResponseBodyTruncated bool      `                            json:"response_body_truncated,omitempty"`
	ID                    int       `gorm:"primaryKey"           json:"id"`
	LogID                 int       `gorm:"index"                json:"log_id"`
}

var hiddenRequestBodyFields = map[string]struct{}{
	"message":  {},
	"messages": {},
}

func truncateDetailBody(body string, maxSize int64) (string, bool) {
	switch {
	case maxSize < 0:
		return "", true
	case maxSize == 0:
		return body, false
	case int64(len(body)) <= maxSize:
		return body, false
	default:
		if maxSize <= 3 {
			return common.TruncateByRune(body, int(maxSize)), true
		}

		return common.TruncateByRune(body, int(maxSize)-3) + "...", true
	}
}

func (d *RequestDetail) ApplyBodySizeLimits(requestMaxSize, responseMaxSize int64) {
	d.SanitizeRequestBody()
	d.SanitizeResponseBody()
	d.RequestBody, d.RequestBodyTruncated = truncateDetailBody(d.RequestBody, requestMaxSize)
	d.ResponseBody, d.ResponseBodyTruncated = truncateDetailBody(d.ResponseBody, responseMaxSize)
}

func (d *RequestDetail) SanitizeRequestBody() {
	if d == nil || d.RequestBody == "" {
		return
	}

	var payload any
	if err := sonic.UnmarshalString(d.RequestBody, &payload); err != nil {
		return
	}

	switch payload.(type) {
	case map[string]any, []any:
	default:
		return
	}

	requestBody, err := sonic.MarshalString(sanitizeRequestBodyValue(payload))
	if err != nil {
		return
	}

	d.RequestBody = requestBody
}

func sanitizeRequestBodyValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		sanitized := make(map[string]any, len(typed))
		for key, item := range typed {
			if _, hidden := hiddenRequestBodyFields[key]; hidden {
				continue
			}
			sanitized[key] = sanitizeRequestBodyValue(item)
		}
		return sanitized
	case []any:
		sanitized := make([]any, len(typed))
		for index, item := range typed {
			sanitized[index] = sanitizeRequestBodyValue(item)
		}
		return sanitized
	default:
		return value
	}
}

func (d *RequestDetail) SanitizeResponseBody() {
	if d == nil || d.ResponseBody == "" {
		return
	}

	d.ResponseBody = common.SanitizeErrorMessage(d.ResponseBody)
}

type Log struct {
	RequestDetail    *RequestDetail   `gorm:"foreignKey:LogID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"request_detail,omitempty"`
	AppUser          *LogAppUser      `gorm:"-"                                                                  json:"app_user,omitempty"`
	RequestAt        time.Time        `                                                                      json:"request_at"`
	RetryAt          time.Time        `                                                                      json:"retry_at,omitempty"`
	TTFBMilliseconds ZeroNullInt64    `                                                                      json:"ttfb_milliseconds,omitempty"`
	CreatedAt        time.Time        `gorm:"autoCreateTime;index"                                           json:"created_at"`
	TokenName        string           `gorm:"size:32"                                                        json:"token_name,omitempty"`
	Endpoint         EmptyNullString  `gorm:"size:64"                                                        json:"endpoint,omitempty"`
	Content          EmptyNullString  `gorm:"type:text"                                                      json:"content,omitempty"`
	GroupID          string           `gorm:"size:64"                                                        json:"group,omitempty"`
	Model            string           `gorm:"size:128"                                                       json:"model"`
	RequestID        EmptyNullString  `gorm:"type:char(16);index:,where:request_id is not null"              json:"request_id"`
	UpstreamID       EmptyNullString  `gorm:"type:varchar(256)"                                              json:"upstream_id,omitempty"`
	AsyncUsageStatus AsyncUsageStatus `                                                                      json:"async_usage_status,omitempty"`
	ID               int              `gorm:"primaryKey"                                                     json:"id"`
	TokenID          int              `gorm:"index"                                                          json:"token_id,omitempty"`
	OwnerUserID      int              `gorm:"index"                                                          json:"owner_user_id,omitempty"`
	ChannelID        int              `                                                                      json:"channel,omitempty"`
	Code             int              `gorm:"index"                                                          json:"code,omitempty"`
	Mode             int              `                                                                      json:"mode,omitempty"`
	IP               EmptyNullString  `gorm:"size:45;index:,where:ip is not null"                            json:"ip,omitempty"`
	RetryTimes       ZeroNullInt64    `                                                                      json:"retry_times,omitempty"`
	Price            Price            `gorm:"embedded"                                                       json:"price,omitempty"`
	Usage            Usage            `gorm:"embedded"                                                       json:"usage,omitempty"`
	Amount           Amount           `gorm:"embedded"                                                       json:"amount,omitempty"`
	ServiceTier      string           `gorm:"size:16"                                                        json:"service_tier,omitempty"`
	PromptCacheKey   EmptyNullString  `gorm:"type:text"                                                      json:"prompt_cache_key,omitempty"`
	// https://platform.openai.com/docs/guides/safety-best-practices#end-user-ids
	User     EmptyNullString   `gorm:"type:text"                     json:"user,omitempty"`
	Metadata map[string]string `gorm:"serializer:fastjson;type:text" json:"metadata,omitempty"`
}

type LogAppUser struct {
	ID    int    `json:"id"`
	Email string `json:"email,omitempty"`
	Phone string `json:"phone,omitempty"`
}

func attachAppUsersToLogs(logs []*Log) error {
	if len(logs) == 0 {
		return nil
	}

	userIDs := make([]int, 0)
	seen := make(map[int]struct{})
	for _, log := range logs {
		if log == nil || log.OwnerUserID == 0 {
			continue
		}

		if _, ok := seen[log.OwnerUserID]; ok {
			continue
		}

		seen[log.OwnerUserID] = struct{}{}
		userIDs = append(userIDs, log.OwnerUserID)
	}

	if len(userIDs) == 0 {
		return nil
	}

	users := make([]*AppUser, 0, len(userIDs))
	if err := DB.Select("id", "email", "phone").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return err
	}

	userMap := make(map[int]*LogAppUser, len(users))
	for _, user := range users {
		userMap[user.ID] = &LogAppUser{
			ID:    user.ID,
			Email: string(user.Email),
			Phone: string(user.Phone),
		}
	}

	for _, log := range logs {
		if log == nil || log.OwnerUserID == 0 {
			continue
		}

		if user, ok := userMap[log.OwnerUserID]; ok {
			log.AppUser = user
			continue
		}

		log.AppUser = &LogAppUser{ID: log.OwnerUserID}
	}

	return nil
}

func CreateLogIndexes(db *gorm.DB) error {
	var indexes []string
	if common.UsingSQLite {
		// not support INCLUDE
		indexes = []string{
			// used by global search logs
			"CREATE INDEX IF NOT EXISTS idx_model_creat ON logs (model, created_at DESC)",
			// used by global search logs
			"CREATE INDEX IF NOT EXISTS idx_channel_creat ON logs (channel_id, created_at DESC)",
			// used by global search logs
			"CREATE INDEX IF NOT EXISTS idx_channel_model_creat ON logs (channel_id, model, created_at DESC)",

			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_creat ON logs (group_id, created_at DESC)",
			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_token_creat ON logs (group_id, token_name, created_at DESC)",
			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_model_creat ON logs (group_id, model, created_at DESC)",
			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_token_model_creat ON logs (group_id, token_name, model, created_at DESC)",
			// used by user portal logs
			"CREATE INDEX IF NOT EXISTS idx_owner_user_creat ON logs (owner_user_id, created_at DESC)",
		}
	} else {
		indexes = []string{
			// used by global search logs
			"CREATE INDEX IF NOT EXISTS idx_model_creat ON logs (model, created_at DESC) INCLUDE (code)",
			// used by global search logs
			"CREATE INDEX IF NOT EXISTS idx_channel_creat ON logs (channel_id, created_at DESC) INCLUDE (code)",
			// used by global search logs
			"CREATE INDEX IF NOT EXISTS idx_channel_model_creat ON logs (channel_id, model, created_at DESC) INCLUDE (code)",

			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_creat ON logs (group_id, created_at DESC) INCLUDE (code)",
			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_token_creat ON logs (group_id, token_name, created_at DESC) INCLUDE (code)",
			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_model_creat ON logs (group_id, model, created_at DESC) INCLUDE (code)",
			// used by search group logs
			"CREATE INDEX IF NOT EXISTS idx_group_token_model_creat ON logs (group_id, token_name, model, created_at DESC) INCLUDE (code)",
			// used by user portal logs
			"CREATE INDEX IF NOT EXISTS idx_owner_user_creat ON logs (owner_user_id, created_at DESC) INCLUDE (code)",
		}
	}

	for _, index := range indexes {
		if err := db.Exec(index).Error; err != nil {
			return err
		}
	}

	return nil
}

const (
	contentMaxSize = 1024 // 1KB
)

func (l *Log) BeforeCreate(_ *gorm.DB) (err error) {
	if len(l.Content) > contentMaxSize {
		l.Content = common.TruncateByRune(l.Content, contentMaxSize) + "..."
	}

	if l.CreatedAt.IsZero() {
		l.CreatedAt = time.Now()
	}

	if l.RequestAt.IsZero() {
		l.RequestAt = l.CreatedAt
	}

	return err
}

func (l *Log) MarshalJSON() ([]byte, error) {
	type Alias Log

	a := &struct {
		*Alias
		CreatedAt  int64   `json:"created_at"`
		RequestAt  int64   `json:"request_at"`
		RetryAt    int64   `json:"retry_at,omitempty"`
		UsedAmount float64 `json:"used_amount,omitempty"`
	}{
		Alias:      (*Alias)(l),
		CreatedAt:  l.CreatedAt.UnixMilli(),
		RequestAt:  l.RequestAt.UnixMilli(),
		UsedAmount: l.Amount.UsedAmount,
	}
	if !l.RetryAt.IsZero() {
		a.RetryAt = l.RetryAt.UnixMilli()
	}

	return sonic.Marshal(a)
}

func GetLogDetail(logID int) (*RequestDetail, error) {
	var detail RequestDetail

	err := LogDB.
		Model(&RequestDetail{}).
		Where("log_id = ?", logID).
		First(&detail).Error
	if err != nil {
		return nil, err
	}

	return &detail, nil
}

func GetGroupLogDetail(logID int, group string) (*RequestDetail, error) {
	if group == "" {
		return nil, errors.New("invalid group parameter")
	}

	var detail RequestDetail

	err := LogDB.
		Model(&RequestDetail{}).
		Joins("JOIN logs ON logs.id = request_details.log_id").
		Where("logs.group_id = ?", group).
		Where("log_id = ?", logID).
		First(&detail).Error
	if err != nil {
		return nil, err
	}

	return &detail, nil
}

func getAppUserTokenIDs(userID int) ([]int, error) {
	var tokenIDs []int

	err := DB.
		Model(&Token{}).
		Where("owner_user_id = ?", userID).
		Pluck("id", &tokenIDs).Error

	return tokenIDs, err
}

func applyAppUserLogScope(tx *gorm.DB, userID int, tokenIDs []int) *gorm.DB {
	if len(tokenIDs) == 0 {
		return tx.Where("owner_user_id = ?", userID)
	}

	return tx.Where("(owner_user_id = ? OR token_id IN ?)", userID, tokenIDs)
}

func GetAppUserLogDetail(userID, logID int) (*RequestDetail, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}

	tokenIDs, err := getAppUserTokenIDs(userID)
	if err != nil {
		return nil, err
	}

	var detail RequestDetail

	tx := LogDB.
		Model(&RequestDetail{}).
		Joins("JOIN logs ON logs.id = request_details.log_id").
		Where("request_details.log_id = ?", logID)

	err = applyAppUserLogScope(tx, userID, tokenIDs).First(&detail).Error
	if err != nil {
		return nil, err
	}

	return &detail, nil
}

const defaultCleanLogBatchSize = 10000

func CleanLog(batchSize int, optimize bool) (err error) {
	err = cleanLog(batchSize)
	if err != nil {
		return err
	}

	err = cleanLogDetail(batchSize)
	if err != nil {
		return err
	}

	err = cleanAsyncUsageInfo(batchSize)
	if err != nil {
		return err
	}

	if optimize {
		return optimizeLog()
	}

	return nil
}

func cleanLog(batchSize int) error {
	if batchSize <= 0 {
		batchSize = defaultCleanLogBatchSize
	}

	logStorageHours := config.GetLogStorageHours()
	if logStorageHours != 0 {
		subQuery := LogDB.
			Model(&Log{}).
			Where(
				"created_at < ?",
				time.Now().Add(-time.Duration(logStorageHours)*time.Hour),
			).
			Limit(batchSize).
			Select("id")

		err := LogDB.
			Session(&gorm.Session{SkipDefaultTransaction: true}).
			Where("id IN (?)", subQuery).
			Delete(&Log{}).Error
		if err != nil {
			return err
		}
	}

	retryLogStorageHours := config.GetRetryLogStorageHours()
	if retryLogStorageHours == 0 {
		retryLogStorageHours = logStorageHours
	}

	if retryLogStorageHours != 0 {
		subQuery := LogDB.
			Model(&RetryLog{}).
			Where(
				"created_at < ?",
				time.Now().Add(-time.Duration(retryLogStorageHours)*time.Hour),
			).
			Limit(batchSize).
			Select("id")

		err := LogDB.
			Session(&gorm.Session{SkipDefaultTransaction: true}).
			Where("id IN (?)", subQuery).
			Delete(&RetryLog{}).Error
		if err != nil {
			return err
		}
	}

	return LogDB.
		Model(&StoreV2{}).
		Where("expires_at < ?", time.Now()).
		Delete(&StoreV2{}).
		Error
}

func cleanAsyncUsageInfo(batchSize int) error {
	logStorageHours := config.GetLogStorageHours()
	if logStorageHours == 0 {
		return nil
	}

	return CleanupFinishedAsyncUsages(time.Duration(logStorageHours)*time.Hour, batchSize)
}

func optimizeLog() error {
	switch {
	case common.UsingSQLite:
		return LogDB.Exec("VACUUM").Error
	default:
		return LogDB.Exec("VACUUM ANALYZE logs").Error
	}
}

func cleanLogDetail(batchSize int) error {
	detailStorageHours := config.GetLogDetailStorageHours()
	if detailStorageHours == 0 {
		detailStorageHours = config.GetLogStorageHours()
	}

	if detailStorageHours == 0 {
		return nil
	}

	if batchSize <= 0 {
		batchSize = defaultCleanLogBatchSize
	}

	subQuery := LogDB.
		Model(&RequestDetail{}).
		Where(
			"created_at < ?",
			time.Now().Add(-time.Duration(detailStorageHours)*time.Hour),
		).
		Limit(batchSize).
		Select("id")

	err := LogDB.
		Session(&gorm.Session{SkipDefaultTransaction: true}).
		Where("id IN (?)", subQuery).
		Delete(&RequestDetail{}).Error
	if err != nil {
		return err
	}

	return nil
}

func RecordConsumeLog(
	requestID string,
	createAt time.Time,
	requestAt time.Time,
	retryAt time.Time,
	firstByteAt time.Time,
	group string,
	code int,
	channelID int,
	modelName string,
	tokenID int,
	tokenName string,
	ownerUserID int,
	endpoint string,
	content string,
	mode int,
	ip string,
	retryTimes int,
	requestDetail *RequestDetail,
	usage Usage,
	modelPrice Price,
	amountDetail Amount,
	user string,
	metadata map[string]string,
	promptCacheKey string,
	upstreamID string,
	serviceTier string,
	asyncUsageStatus AsyncUsageStatus,
) error {
	if createAt.IsZero() {
		createAt = time.Now()
	}

	if requestAt.IsZero() {
		requestAt = createAt
	}

	if firstByteAt.IsZero() || firstByteAt.Before(requestAt) {
		firstByteAt = requestAt
	}

	// Truncate upstreamID to max length
	const maxUpstreamIDLength = 256
	if len(upstreamID) > maxUpstreamIDLength {
		upstreamID = upstreamID[:maxUpstreamIDLength]
	}

	log := &Log{
		RequestID:        EmptyNullString(requestID),
		RequestAt:        requestAt,
		CreatedAt:        createAt,
		RetryAt:          retryAt,
		TTFBMilliseconds: ZeroNullInt64(firstByteAt.Sub(requestAt).Milliseconds()),
		GroupID:          group,
		Code:             code,
		TokenID:          tokenID,
		TokenName:        tokenName,
		OwnerUserID:      ownerUserID,
		Model:            modelName,
		Mode:             mode,
		IP:               EmptyNullString(ip),
		ChannelID:        channelID,
		Endpoint:         EmptyNullString(endpoint),
		Content:          EmptyNullString(content),
		RetryTimes:       ZeroNullInt64(retryTimes),
		RequestDetail:    requestDetail,
		Price:            modelPrice,
		Usage:            usage,
		Amount:           amountDetail,
		User:             EmptyNullString(user),
		Metadata:         metadata,
		PromptCacheKey:   EmptyNullString(promptCacheKey),
		UpstreamID:       EmptyNullString(upstreamID),
		ServiceTier:      serviceTier,
		AsyncUsageStatus: asyncUsageStatus,
	}

	return LogDB.Create(log).Error
}

func getLogOrder(order string) string {
	prefix, suffix, _ := strings.Cut(order, "-")
	switch prefix {
	case "created_at", "request_at", "id":
		switch suffix {
		case "asc":
			return prefix + " asc"
		default:
			return prefix + " desc"
		}
	default:
		return "created_at desc"
	}
}

type CodeType string

const (
	CodeTypeAll     CodeType = "all"
	CodeTypeSuccess CodeType = "success"
	CodeTypeError   CodeType = "error"
)

type GetLogsResult struct {
	Logs     []*Log   `json:"logs"`
	Total    int64    `json:"total"`
	Channels []int    `json:"channels,omitempty"`
	Models   []string `json:"models,omitempty"`
}

type LogStats struct {
	TotalCount          int64   `json:"total_count"`
	SuccessCount        int64   `json:"success_count"`
	ErrorCount          int64   `json:"error_count"`
	UsedAmount          float64 `json:"used_amount"`
	InputTokens         int64   `json:"input_tokens"`
	OutputTokens        int64   `json:"output_tokens"`
	TotalTokens         int64   `json:"total_tokens"`
	AverageMilliseconds float64 `json:"average_milliseconds"`
	AverageTTFB         float64 `json:"average_ttfb_milliseconds"`
}

type GetGroupLogsResult struct {
	GetLogsResult
	TokenNames []string `json:"token_names"`
}

func buildGetLogsQuery(
	group string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	channelID int,
	codeType CodeType,
	code int,
	ip string,
	user string,
) *gorm.DB {
	tx := LogDB.Model(&Log{})

	if requestID != "" {
		tx = tx.Where("request_id = ?", requestID)
	}

	if upstreamID != "" {
		tx = tx.Where("upstream_id = ?", upstreamID)
	}

	if ip != "" {
		tx = tx.Where("ip = ?", ip)
	}

	if group != "" {
		tx = tx.Where("group_id = ?", group)
	}

	if modelName != "" {
		tx = tx.Where("model = ?", modelName)
	}

	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}

	if channelID != 0 {
		tx = tx.Where("channel_id = ?", channelID)
	}

	switch {
	case !startTimestamp.IsZero() && !endTimestamp.IsZero():
		tx = tx.Where("created_at BETWEEN ? AND ?", startTimestamp, endTimestamp)
	case !startTimestamp.IsZero():
		tx = tx.Where("created_at >= ?", startTimestamp)
	case !endTimestamp.IsZero():
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	switch codeType {
	case CodeTypeSuccess:
		tx = tx.Where("code = 200")
	case CodeTypeError:
		tx = tx.Where("code != 200")
	default:
		if code != 0 {
			tx = tx.Where("code = ?", code)
		}
	}

	if tokenID != 0 {
		tx = tx.Where("token_id = ?", tokenID)
	}

	if user != "" {
		tx = applyLogUserFilter(tx, user)
	}

	return tx
}

func applyLogUserFilter(tx *gorm.DB, user string) *gorm.DB {
	user = strings.TrimSpace(user)
	if user == "" {
		return tx
	}

	userIDs := make([]int, 0)
	if id := String2Int(user); id > 0 {
		userIDs = append(userIDs, id)
	}

	likeUser := "%" + user + "%"
	users := make([]*AppUser, 0)
	if err := DB.
		Select("id").
		Where("email LIKE ? OR phone LIKE ?", likeUser, likeUser).
		Find(&users).Error; err == nil {
		seen := make(map[int]struct{}, len(userIDs)+len(users))
		for _, id := range userIDs {
			seen[id] = struct{}{}
		}
		for _, appUser := range users {
			if appUser == nil || appUser.ID == 0 {
				continue
			}
			if _, ok := seen[appUser.ID]; ok {
				continue
			}
			seen[appUser.ID] = struct{}{}
			userIDs = append(userIDs, appUser.ID)
		}
	}

	conditions := LogDB.Where("user = ?", user)
	if len(userIDs) > 0 {
		conditions = conditions.Or("owner_user_id IN ?", userIDs)
	}
	return tx.Where(conditions)
}

func scanLogStats(tx *gorm.DB) (*LogStats, error) {
	stats := &LogStats{}
	durationSQL := "EXTRACT(EPOCH FROM (created_at - request_at)) * 1000"
	if common.UsingSQLite {
		durationSQL = "(julianday(created_at) - julianday(request_at)) * 86400000"
	}

	err := tx.Select(
		"COUNT(*) AS total_count, " +
			"COALESCE(SUM(CASE WHEN code = 200 THEN 1 ELSE 0 END), 0) AS success_count, " +
			"COALESCE(SUM(CASE WHEN code != 200 THEN 1 ELSE 0 END), 0) AS error_count, " +
			"COALESCE(SUM(used_amount), 0) AS used_amount, " +
			"COALESCE(SUM(input_tokens), 0) AS input_tokens, " +
			"COALESCE(SUM(output_tokens), 0) AS output_tokens, " +
			"COALESCE(SUM(total_tokens), 0) AS total_tokens, " +
			"COALESCE(AVG(" + durationSQL + "), 0) AS average_milliseconds, " +
			"COALESCE(AVG(ttfb_milliseconds), 0) AS average_ttfb_milliseconds",
	).Scan(stats).Error

	return stats, err
}

func getLogs(
	group string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	page int,
	perPage int,
) (int64, []*Log, error) {
	var (
		total int64
		logs  []*Log
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		return buildGetLogsQuery(
			group,
			startTimestamp,
			endTimestamp,
			modelName,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			channelID,
			codeType,
			code,
			ip,
			user,
		).Count(&total).Error
	})

	g.Go(func() error {
		query := buildGetLogsQuery(
			group,
			startTimestamp,
			endTimestamp,
			modelName,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			channelID,
			codeType,
			code,
			ip,
			user,
		)
		if withBody {
			query = query.Preload("RequestDetail")
		} else {
			query = query.Preload("RequestDetail", func(db *gorm.DB) *gorm.DB {
				return db.Select("id", "log_id")
			})
		}

		limit, offset := toLimitOffset(page, perPage)

		return query.
			Order(getLogOrder(order)).
			Limit(limit).
			Offset(offset).
			Find(&logs).Error
	})

	if err := g.Wait(); err != nil {
		return 0, nil, err
	}

	return total, logs, nil
}

func buildAppUserLogsQuery(
	userID int,
	tokenIDs []int,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	codeType CodeType,
	code int,
	user string,
) *gorm.DB {
	tx := applyAppUserLogScope(LogDB.Model(&Log{}), userID, tokenIDs)

	if requestID != "" {
		tx = tx.Where("request_id = ?", requestID)
	}

	if upstreamID != "" {
		tx = tx.Where("upstream_id = ?", upstreamID)
	}

	if modelName != "" {
		tx = tx.Where("model = ?", modelName)
	}

	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}

	switch {
	case !startTimestamp.IsZero() && !endTimestamp.IsZero():
		tx = tx.Where("created_at BETWEEN ? AND ?", startTimestamp, endTimestamp)
	case !startTimestamp.IsZero():
		tx = tx.Where("created_at >= ?", startTimestamp)
	case !endTimestamp.IsZero():
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	switch codeType {
	case CodeTypeSuccess:
		tx = tx.Where("code = 200")
	case CodeTypeError:
		tx = tx.Where("code != 200")
	default:
		if code != 0 {
			tx = tx.Where("code = ?", code)
		}
	}

	if tokenID != 0 {
		tx = tx.Where("token_id = ?", tokenID)
	}

	if user != "" {
		tx = applyLogUserFilter(tx, user)
	}

	return tx
}

func getAppUserLogs(
	userID int,
	tokenIDs []int,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	user string,
	page int,
	perPage int,
) (int64, []*Log, error) {
	var (
		total int64
		logs  []*Log
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		return buildAppUserLogsQuery(
			userID,
			tokenIDs,
			startTimestamp,
			endTimestamp,
			modelName,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			codeType,
			code,
			user,
		).Count(&total).Error
	})

	g.Go(func() error {
		query := buildAppUserLogsQuery(
			userID,
			tokenIDs,
			startTimestamp,
			endTimestamp,
			modelName,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			codeType,
			code,
			user,
		)
		if withBody {
			query = query.Preload("RequestDetail")
		} else {
			query = query.Preload("RequestDetail", func(db *gorm.DB) *gorm.DB {
				return db.Select("id", "log_id")
			})
		}

		limit, offset := toLimitOffset(page, perPage)

		return query.
			Order(getLogOrder(order)).
			Limit(limit).
			Offset(offset).
			Find(&logs).Error
	})

	if err := g.Wait(); err != nil {
		return 0, nil, err
	}

	return total, logs, nil
}

func GetAppUserLogs(
	userID int,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	user string,
	page int,
	perPage int,
) (*GetLogsResult, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}

	tokenIDs, err := getAppUserTokenIDs(userID)
	if err != nil {
		return nil, err
	}

	total, logs, err := getAppUserLogs(
		userID,
		tokenIDs,
		startTimestamp,
		endTimestamp,
		modelName,
		requestID,
		upstreamID,
		tokenID,
		tokenName,
		order,
		codeType,
		code,
		withBody,
		user,
		page,
		perPage,
	)
	if err != nil {
		return nil, err
	}

	if err := attachAppUsersToLogs(logs); err != nil {
		return nil, err
	}

	return &GetLogsResult{
		Logs:  logs,
		Total: total,
	}, nil
}

func GetLogs(
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	page int,
	perPage int,
) (*GetLogsResult, error) {
	var (
		total    int64
		logs     []*Log
		channels []int
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		var err error

		channels, err = GetUsedChannels(startTimestamp, endTimestamp)
		return err
	})

	g.Go(func() error {
		var err error

		total, logs, err = getLogs(
			"",
			startTimestamp,
			endTimestamp,
			modelName,
			requestID,
			upstreamID,
			0,
			"",
			channelID,
			order,
			codeType,
			code,
			withBody,
			ip,
			user,
			page,
			perPage,
		)

		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	if err := attachAppUsersToLogs(logs); err != nil {
		return nil, err
	}

	result := &GetLogsResult{
		Logs:     logs,
		Total:    total,
		Channels: channels,
	}

	return result, nil
}

func GetGroupLogs(
	group string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	page int,
	perPage int,
) (*GetGroupLogsResult, error) {
	if group == "" {
		return nil, errors.New("group is required")
	}

	var (
		total      int64
		logs       []*Log
		tokenNames []string
		models     []string
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		var err error

		total, logs, err = getLogs(
			group,
			startTimestamp,
			endTimestamp,
			modelName,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			0,
			order,
			codeType,
			code,
			withBody,
			ip,
			user,
			page,
			perPage,
		)

		return err
	})

	g.Go(func() error {
		var err error

		tokenNames, err = GetGroupUsedTokenNames(group, startTimestamp, endTimestamp)
		return err
	})

	g.Go(func() error {
		var err error

		models, err = GetGroupUsedModels(group, tokenName, startTimestamp, endTimestamp)
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	if err := attachAppUsersToLogs(logs); err != nil {
		return nil, err
	}

	return &GetGroupLogsResult{
		GetLogsResult: GetLogsResult{
			Logs:   logs,
			Total:  total,
			Models: models,
		},
		TokenNames: tokenNames,
	}, nil
}

func exportLogs(
	group string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	maxEntries int,
) ([]*Log, error) {
	var logs []*Log

	query := buildGetLogsQuery(
		group,
		startTimestamp,
		endTimestamp,
		modelName,
		requestID,
		upstreamID,
		tokenID,
		tokenName,
		channelID,
		codeType,
		code,
		ip,
		user,
	)

	if withBody {
		query = query.Preload("RequestDetail")
	}

	query = query.Order(getLogOrder(order))
	if maxEntries > 0 {
		query = query.Limit(maxEntries)
	}

	return logs, query.Find(&logs).Error
}

func exportLogsRange(
	group string,
	startTimestamp time.Time,
	endExclusive time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	maxEntries int,
) ([]*Log, error) {
	var logs []*Log

	query := buildGetLogsQuery(
		group,
		time.Time{},
		time.Time{},
		modelName,
		requestID,
		upstreamID,
		tokenID,
		tokenName,
		channelID,
		codeType,
		code,
		ip,
		user,
	)

	if !startTimestamp.IsZero() {
		query = query.Where("created_at >= ?", startTimestamp)
	}

	if !endExclusive.IsZero() {
		query = query.Where("created_at < ?", endExclusive)
	}

	if withBody {
		query = query.Preload("RequestDetail")
	}

	query = query.Order(getLogOrder(order))
	if maxEntries > 0 {
		query = query.Limit(maxEntries)
	}

	return logs, query.Find(&logs).Error
}

func ExportLogs(
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	maxEntries int,
) ([]*Log, error) {
	return exportLogs(
		"",
		startTimestamp,
		endTimestamp,
		modelName,
		requestID,
		upstreamID,
		0,
		"",
		channelID,
		order,
		codeType,
		code,
		withBody,
		ip,
		user,
		maxEntries,
	)
}

func ExportGroupLogs(
	group string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	maxEntries int,
) ([]*Log, error) {
	if group == "" {
		return nil, errors.New("group is required")
	}

	return exportLogs(
		group,
		startTimestamp,
		endTimestamp,
		modelName,
		requestID,
		upstreamID,
		tokenID,
		tokenName,
		0,
		order,
		codeType,
		code,
		withBody,
		ip,
		user,
		maxEntries,
	)
}

func ExportLogsRange(
	startTimestamp time.Time,
	endExclusive time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	maxEntries int,
) ([]*Log, error) {
	return exportLogsRange(
		"",
		startTimestamp,
		endExclusive,
		modelName,
		requestID,
		upstreamID,
		0,
		"",
		channelID,
		order,
		codeType,
		code,
		withBody,
		ip,
		user,
		maxEntries,
	)
}

func ExportGroupLogsRange(
	group string,
	startTimestamp time.Time,
	endExclusive time.Time,
	modelName string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	maxEntries int,
) ([]*Log, error) {
	if group == "" {
		return nil, errors.New("group is required")
	}

	return exportLogsRange(
		group,
		startTimestamp,
		endExclusive,
		modelName,
		requestID,
		upstreamID,
		tokenID,
		tokenName,
		0,
		order,
		codeType,
		code,
		withBody,
		ip,
		user,
		maxEntries,
	)
}

func buildSearchLogsQuery(
	group string,
	keyword string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	modelName string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	channelID int,
	codeType CodeType,
	code int,
	ip string,
	user string,
) *gorm.DB {
	tx := LogDB.Model(&Log{})

	if requestID != "" {
		tx = tx.Where("request_id = ?", requestID)
	}

	if upstreamID != "" {
		tx = tx.Where("upstream_id = ?", upstreamID)
	}

	if ip != "" {
		tx = tx.Where("ip = ?", ip)
	}

	if group != "" {
		tx = tx.Where("group_id = ?", group)
	}

	if modelName != "" {
		tx = tx.Where("model = ?", modelName)
	}

	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}

	if channelID != 0 {
		tx = tx.Where("channel_id = ?", channelID)
	}

	switch {
	case !startTimestamp.IsZero() && !endTimestamp.IsZero():
		tx = tx.Where("created_at BETWEEN ? AND ?", startTimestamp, endTimestamp)
	case !startTimestamp.IsZero():
		tx = tx.Where("created_at >= ?", startTimestamp)
	case !endTimestamp.IsZero():
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	switch codeType {
	case CodeTypeSuccess:
		tx = tx.Where("code = 200")
	case CodeTypeError:
		tx = tx.Where("code != 200")
	default:
		if code != 0 {
			tx = tx.Where("code = ?", code)
		}
	}

	if tokenID != 0 {
		tx = tx.Where("token_id = ?", tokenID)
	}

	if user != "" {
		tx = tx.Where("user = ?", user)
	}

	// Handle keyword search for zero value fields
	if keyword != "" {
		var (
			conditions []string
			values     []any
		)

		if requestID == "" {
			conditions = append(conditions, "request_id = ?")
			values = append(values, keyword)
		}

		if upstreamID == "" {
			conditions = append(conditions, "upstream_id = ?")
			values = append(values, keyword)
		}

		if group == "" {
			conditions = append(conditions, "group_id = ?")
			values = append(values, keyword)
		}

		if modelName == "" {
			conditions = append(conditions, "model = ?")
			values = append(values, keyword)
		}

		if tokenName == "" {
			conditions = append(conditions, "token_name = ?")
			values = append(values, keyword)
		}

		// if num := String2Int(keyword); num != 0 {
		// 	if channelID == 0 {
		// 		conditions = append(conditions, "channel_id = ?")
		// 		values = append(values, num)
		// 	}
		// }

		// if ip != "" {
		// 	conditions = append(conditions, "ip = ?")
		// 	values = append(values, ip)
		// }

		// slow query
		// if common.UsingPostgreSQL {
		// 	conditions = append(conditions, "content ILIKE ?")
		// } else {
		// 	conditions = append(conditions, "content LIKE ?")
		// }
		// values = append(values, "%"+keyword+"%")

		if len(conditions) > 0 {
			tx = tx.Where(fmt.Sprintf("(%s)", strings.Join(conditions, " OR ")), values...)
		}
	}

	return tx
}

func searchLogs(
	group string,
	keyword string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	modelName string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	page int,
	perPage int,
) (int64, []*Log, error) {
	var (
		total int64
		logs  []*Log
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		return buildSearchLogsQuery(
			group,
			keyword,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			modelName,
			startTimestamp,
			endTimestamp,
			channelID,
			codeType,
			code,
			ip,
			user,
		).Count(&total).Error
	})

	g.Go(func() error {
		query := buildSearchLogsQuery(
			group,
			keyword,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			modelName,
			startTimestamp,
			endTimestamp,
			channelID,
			codeType,
			code,
			ip,
			user,
		)

		if withBody {
			query = query.Preload("RequestDetail")
		} else {
			query = query.Preload("RequestDetail", func(db *gorm.DB) *gorm.DB {
				return db.Select("id", "log_id")
			})
		}

		limit, offset := toLimitOffset(page, perPage)

		return query.
			Order(getLogOrder(order)).
			Limit(limit).
			Offset(offset).
			Find(&logs).Error
	})

	if err := g.Wait(); err != nil {
		return 0, nil, err
	}

	return total, logs, nil
}

func GetLogStats(
	keyword string,
	requestID string,
	upstreamID string,
	group string,
	tokenID int,
	tokenName string,
	modelName string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	channelID int,
	codeType CodeType,
	code int,
	ip string,
	user string,
) (*LogStats, error) {
	return scanLogStats(buildSearchLogsQuery(
		group,
		keyword,
		requestID,
		upstreamID,
		tokenID,
		tokenName,
		modelName,
		startTimestamp,
		endTimestamp,
		channelID,
		codeType,
		code,
		ip,
		user,
	))
}

func SearchLogs(
	keyword string,
	requestID string,
	upstreamID string,
	group string,
	tokenID int,
	tokenName string,
	modelName string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	channelID int,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	page int,
	perPage int,
) (*GetLogsResult, error) {
	var (
		total    int64
		logs     []*Log
		channels []int
		models   []string
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		var err error

		total, logs, err = searchLogs(
			group,
			keyword,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			modelName,
			startTimestamp,
			endTimestamp,
			channelID,
			order,
			codeType,
			code,
			withBody,
			ip,
			user,
			page,
			perPage,
		)

		return err
	})

	g.Go(func() error {
		var err error

		channels, err = GetUsedChannels(startTimestamp, endTimestamp)
		return err
	})

	g.Go(func() error {
		var err error

		models, err = GetUsedModels(channelID, startTimestamp, endTimestamp)
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	if err := attachAppUsersToLogs(logs); err != nil {
		return nil, err
	}

	result := &GetLogsResult{
		Logs:     logs,
		Total:    total,
		Channels: channels,
		Models:   models,
	}

	return result, nil
}

func SearchGroupLogs(
	group string,
	keyword string,
	requestID string,
	upstreamID string,
	tokenID int,
	tokenName string,
	modelName string,
	startTimestamp time.Time,
	endTimestamp time.Time,
	order string,
	codeType CodeType,
	code int,
	withBody bool,
	ip string,
	user string,
	page int,
	perPage int,
) (*GetGroupLogsResult, error) {
	if group == "" {
		return nil, errors.New("group is required")
	}

	var (
		total      int64
		logs       []*Log
		tokenNames []string
		models     []string
	)

	g := new(errgroup.Group)

	g.Go(func() error {
		var err error

		total, logs, err = searchLogs(group,
			keyword,
			requestID,
			upstreamID,
			tokenID,
			tokenName,
			modelName,
			startTimestamp,
			endTimestamp,
			0,
			order,
			codeType,
			code,
			withBody,
			ip,
			user,
			page,
			perPage,
		)

		return err
	})

	g.Go(func() error {
		var err error

		tokenNames, err = GetGroupUsedTokenNames(group, startTimestamp, endTimestamp)
		return err
	})

	g.Go(func() error {
		var err error

		models, err = GetGroupUsedModels(group, tokenName, startTimestamp, endTimestamp)
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	if err := attachAppUsersToLogs(logs); err != nil {
		return nil, err
	}

	result := &GetGroupLogsResult{
		GetLogsResult: GetLogsResult{
			Logs:   logs,
			Total:  total,
			Models: models,
		},
		TokenNames: tokenNames,
	}

	return result, nil
}

func DeleteOldLog(timestamp time.Time) (int64, error) {
	result := LogDB.Where("created_at < ?", timestamp).Delete(&Log{})
	return result.RowsAffected, result.Error
}

func DeleteGroupLogs(groupID string) (int64, error) {
	if groupID == "" {
		return 0, errors.New("group is required")
	}

	result := LogDB.Where("group_id = ?", groupID).Delete(&Log{})

	return result.RowsAffected, result.Error
}

func GetIPGroups(threshold int, start, end time.Time) (map[string][]string, error) {
	if threshold < 1 {
		threshold = 1
	}

	var selectClause string
	if common.UsingSQLite {
		selectClause = "ip, GROUP_CONCAT(DISTINCT group_id) as groups"
	} else {
		selectClause = "ip, STRING_AGG(DISTINCT group_id, ',') as groups"
	}

	db := LogDB.Model(&Log{}).
		Select(selectClause).
		Group("ip").
		Having("COUNT(DISTINCT group_id) >= ?", threshold)

	switch {
	case !start.IsZero() && !end.IsZero():
		db = db.Where("created_at BETWEEN ? AND ?", start, end)
	case !start.IsZero():
		db = db.Where("created_at >= ?", start)
	case !end.IsZero():
		db = db.Where("created_at <= ?", end)
	}

	db.Where("ip IS NOT NULL AND ip != '' AND group_id != ''")

	result := make(map[string][]string)

	rows, err := db.Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			ip     string
			groups string
		)

		err = rows.Scan(&ip, &groups)
		if err != nil {
			return nil, err
		}

		result[ip] = strings.Split(groups, ",")
	}

	return result, nil
}
