package controller

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/middleware"
	"github.com/labring/aiproxy/core/model"
	"github.com/shopspring/decimal"
)

const (
	duluPayChannel     = "dulupay"
	duluPaySignType    = "RSA"
	duluPayCreatePath  = "/api/pay/create"
	duluPaySuccessText = "success"
)

type CreateDuluPayRechargeRequest struct {
	Amount float64 `json:"amount"`
	Type   string  `json:"type"`
	Device string  `json:"device"`
}

type DuluPayCreateResponse struct {
	Code      int    `json:"code"`
	Msg       string `json:"msg"`
	TradeNo   string `json:"trade_no"`
	PayType   string `json:"pay_type"`
	PayInfo   string `json:"pay_info"`
	Timestamp string `json:"timestamp"`
	Sign      string `json:"sign"`
	SignType  string `json:"sign_type"`
}

type DuluPayRechargeResponse struct {
	OrderID    int     `json:"order_id"`
	Amount     float64 `json:"amount"`
	PayAmount  float64 `json:"pay_amount"`
	Discount   float64 `json:"discount"`
	OutTradeNo string  `json:"out_trade_no"`
	TradeNo    string  `json:"trade_no,omitempty"`
	PayType    string  `json:"pay_type"`
	PayInfo    string  `json:"pay_info"`
}

func CreateDuluPayRecharge(c *gin.Context) {
	user := middleware.GetWalletUser(c)

	req := CreateDuluPayRechargeRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.ErrorResponse(c, http.StatusBadRequest, "invalid parameter")
		return
	}

	amount, message := normalizeRechargeAmount(req.Amount)
	if message != "" {
		middleware.ErrorResponse(c, http.StatusBadRequest, message)
		return
	}

	if err := validateDuluPayConfig(); err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	discount := normalizeRechargeDiscount(config.GetDuluPayRechargeDiscount())
	payAmount := calculateRechargePayAmount(amount, discount)

	outTradeNo := model.NewAppPaymentOutTradeNo(user.ID)
	payType := strings.TrimSpace(req.Type)
	if payType == "" {
		payType = config.DuluPayType
	}
	if !isDuluPayTypeAllowed(payType) {
		middleware.ErrorResponse(c, http.StatusBadRequest, "unsupported payment type")
		return
	}

	device := strings.TrimSpace(req.Device)
	if device == "" {
		device = config.DuluPayDevice
	}

	createResp, err := requestDuluPayCreate(duluPayCreateRequest{
		OutTradeNo: outTradeNo,
		Amount:     payAmount,
		ClientIP:   c.ClientIP(),
		Type:       payType,
		Device:     device,
	})
	if err != nil {
		middleware.ErrorResponse(c, http.StatusBadGateway, err.Error())
		return
	}

	order, err := model.CreateAppPaymentOrder(model.AppPaymentCreateParams{
		UserID:     user.ID,
		Amount:     amount,
		PayAmount:  payAmount,
		Channel:    duluPayChannel,
		OutTradeNo: outTradeNo,
		TradeNo:    createResp.TradeNo,
		PayType:    createResp.PayType,
		PayInfo:    createResp.PayInfo,
	})
	if err != nil {
		middleware.ErrorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.SuccessResponse(c, gin.H{
		"payment": DuluPayRechargeResponse{
			OrderID:    order.ID,
			Amount:     order.Amount,
			PayAmount:  order.ExpectedPayAmount(),
			Discount:   discount,
			OutTradeNo: order.OutTradeNo,
			TradeNo:    string(order.TradeNo),
			PayType:    string(order.PayType),
			PayInfo:    order.PayInfo,
		},
	})
}

func DuluPayNotify(c *gin.Context) {
	if err := validateDuluPayCallback(c.Request.URL.Query()); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	amount, err := strconv.ParseFloat(c.Query("money"), 64)
	if err != nil || amount <= 0 {
		c.String(http.StatusBadRequest, "invalid money")
		return
	}

	payload, _ := sonic.MarshalString(c.Request.URL.Query())
	_, _, _, err = model.MarkAppPaymentOrderPaid(model.AppPaymentPaidParams{
		OutTradeNo:    c.Query("out_trade_no"),
		TradeNo:       c.Query("trade_no"),
		Amount:        amount,
		NotifyPayload: payload,
	})
	if err != nil {
		if errors.Is(err, model.ErrAppPaymentOrderAlreadyHandled) ||
			errors.Is(err, model.ErrAppRechargeTradeNoExists) {
			c.String(http.StatusOK, duluPaySuccessText)
			return
		}

		c.String(http.StatusBadRequest, err.Error())
		return
	}

	c.String(http.StatusOK, duluPaySuccessText)
}

func DuluPayReturn(c *gin.Context) {
	if err := validateDuluPayCallback(c.Request.URL.Query()); err != nil {
		c.Redirect(http.StatusFound, "/dashboard?payment=failed")
		return
	}

	c.Redirect(http.StatusFound, "/dashboard?payment=success")
}

type duluPayCreateRequest struct {
	OutTradeNo string
	Amount     float64
	ClientIP   string
	Type       string
	Device     string
}

func requestDuluPayCreate(req duluPayCreateRequest) (*DuluPayCreateResponse, error) {
	values := url.Values{}
	values.Set("pid", config.DuluPayPID)
	values.Set("method", config.DuluPayMethod)
	values.Set("device", req.Device)
	values.Set("type", req.Type)
	values.Set("out_trade_no", req.OutTradeNo)
	values.Set("notify_url", config.DuluPayNotifyURL)
	values.Set("return_url", config.DuluPayReturnURL)
	values.Set("name", config.DuluPayProductName)
	values.Set("money", formatDuluPayMoney(req.Amount))
	values.Set("clientip", req.ClientIP)
	values.Set("timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	values.Set("sign_type", duluPaySignType)

	sign, err := signDuluPayValues(values)
	if err != nil {
		return nil, err
	}
	values.Set("sign", sign)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.PostForm(config.DuluPayAPIBaseURL+duluPayCreatePath, values)
	if err != nil {
		return nil, fmt.Errorf("failed to create dulupay order: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("dulupay create failed with status %d", resp.StatusCode)
	}

	var createResp DuluPayCreateResponse
	if err := sonic.ConfigDefault.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		return nil, fmt.Errorf("failed to decode dulupay response: %w", err)
	}

	if createResp.Code != 0 {
		if createResp.Msg == "" {
			createResp.Msg = "dulupay create failed"
		}

		return nil, errors.New(createResp.Msg)
	}

	if createResp.Sign != "" && !verifyDuluPayMap(map[string]string{
		"code":      strconv.Itoa(createResp.Code),
		"trade_no":  createResp.TradeNo,
		"pay_type":  createResp.PayType,
		"pay_info":  createResp.PayInfo,
		"timestamp": createResp.Timestamp,
		"sign":      createResp.Sign,
		"sign_type": createResp.SignType,
	}) {
		return nil, errors.New("dulupay response signature verification failed")
	}

	if createResp.PayType == "" || createResp.PayInfo == "" {
		return nil, errors.New("dulupay response missing pay info")
	}

	return &createResp, nil
}

func validateDuluPayCallback(values url.Values) error {
	if err := validateDuluPayConfigForVerify(); err != nil {
		return err
	}

	if values.Get("pid") != config.DuluPayPID {
		return errors.New("invalid pid")
	}

	if values.Get("trade_status") != "TRADE_SUCCESS" {
		return errors.New("trade is not successful")
	}

	if values.Get("out_trade_no") == "" {
		return errors.New("out trade no is empty")
	}

	if values.Get("money") == "" {
		return errors.New("money is empty")
	}

	if !verifyDuluPayValues(values) {
		return errors.New("signature verification failed")
	}

	order, err := model.GetAppPaymentOrderByOutTradeNo(values.Get("out_trade_no"))
	if err != nil {
		return err
	}

	amount, err := strconv.ParseFloat(values.Get("money"), 64)
	if err != nil {
		return errors.New("invalid money")
	}

	if !moneyEqual(order.ExpectedPayAmount(), amount) {
		return model.ErrAppPaymentOrderAmountMismatch
	}

	return nil
}

func normalizeRechargeAmount(amount float64) (float64, string) {
	if amount <= 0 {
		return 0, "amount must be greater than zero"
	}

	amount = decimal.NewFromFloat(amount).Round(2).InexactFloat64()
	if amount < config.DuluPayMinAmount {
		return 0, fmt.Sprintf("amount must be at least %.2f", config.DuluPayMinAmount)
	}

	if config.DuluPayMaxAmount > 0 && amount > config.DuluPayMaxAmount {
		return 0, fmt.Sprintf("amount must be at most %.2f", config.DuluPayMaxAmount)
	}

	return amount, ""
}

func normalizeRechargeDiscount(discount float64) float64 {
	if discount <= 0 || discount > 1 {
		return 1
	}

	return decimal.NewFromFloat(discount).Round(4).InexactFloat64()
}

func calculateRechargePayAmount(amount float64, discount float64) float64 {
	payAmount := decimal.NewFromFloat(amount).
		Mul(decimal.NewFromFloat(normalizeRechargeDiscount(discount))).
		Round(2)
	if payAmount.LessThanOrEqual(decimal.Zero) {
		return amount
	}

	return payAmount.InexactFloat64()
}

func validateDuluPayConfig() error {
	if config.DuluPayPID == "" ||
		config.DuluPayPrivateKey == "" ||
		config.DuluPayPublicKey == "" ||
		config.DuluPayNotifyURL == "" ||
		config.DuluPayReturnURL == "" {
		return errors.New("dulupay is not configured")
	}

	return nil
}

func validateDuluPayConfigForVerify() error {
	if config.DuluPayPID == "" || config.DuluPayPublicKey == "" {
		return errors.New("dulupay is not configured")
	}

	return nil
}

func isDuluPayTypeAllowed(payType string) bool {
	switch payType {
	case "alipay", "wxpay":
		return true
	default:
		return false
	}
}

func signDuluPayValues(values url.Values) (string, error) {
	privateKey, err := parseRSAPrivateKey(config.DuluPayPrivateKey)
	if err != nil {
		return "", err
	}

	signingText := buildDuluPaySigningText(values)
	sum := sha256.Sum256([]byte(signingText))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}

func verifyDuluPayValues(values url.Values) bool {
	data := make(map[string]string, len(values))
	for key := range values {
		data[key] = values.Get(key)
	}

	return verifyDuluPayMap(data)
}

func verifyDuluPayMap(values map[string]string) bool {
	sign := strings.TrimSpace(values["sign"])
	if sign == "" {
		return false
	}

	publicKey, err := parseRSAPublicKey(config.DuluPayPublicKey)
	if err != nil {
		return false
	}

	signingText := buildDuluPaySigningTextFromMap(values)
	sum := sha256.Sum256([]byte(signingText))
	signature, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return false
	}

	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, sum[:], signature) == nil
}

func buildDuluPaySigningText(values url.Values) string {
	data := make(map[string]string, len(values))
	for key := range values {
		data[key] = values.Get(key)
	}

	return buildDuluPaySigningTextFromMap(data)
}

func buildDuluPaySigningTextFromMap(values map[string]string) string {
	keys := make([]string, 0, len(values))
	for key, value := range values {
		if key == "sign" || key == "sign_type" || value == "" {
			continue
		}

		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values[key])
	}

	return strings.Join(parts, "&")
}

func parseRSAPrivateKey(value string) (*rsa.PrivateKey, error) {
	keyDER, err := decodeDuluPayKey(value)
	if err != nil {
		return nil, fmt.Errorf("invalid dulupay private key: %w", err)
	}

	var parseErrors []string
	if parsed, err := x509.ParsePKCS8PrivateKey(keyDER); err == nil {
		key, ok := parsed.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("dulupay private key is not rsa")
		}

		return key, nil
	} else {
		parseErrors = append(parseErrors, "PKCS8: "+err.Error())
	}

	if key, err := x509.ParsePKCS1PrivateKey(keyDER); err == nil {
		return key, nil
	} else {
		parseErrors = append(parseErrors, "PKCS1: "+err.Error())
	}

	return nil, fmt.Errorf(
		"unsupported dulupay private key format; expected PKCS8 or PKCS1 RSA private key (%s)",
		strings.Join(parseErrors, "; "),
	)
}

func parseRSAPublicKey(value string) (*rsa.PublicKey, error) {
	keyDER, err := decodeDuluPayKey(value)
	if err != nil {
		return nil, fmt.Errorf("invalid dulupay public key: %w", err)
	}

	var parseErrors []string
	if parsed, err := x509.ParsePKIXPublicKey(keyDER); err == nil {
		key, ok := parsed.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("dulupay public key is not rsa")
		}

		return key, nil
	} else {
		parseErrors = append(parseErrors, "PKIX: "+err.Error())
	}

	if key, err := x509.ParsePKCS1PublicKey(keyDER); err == nil {
		return key, nil
	} else {
		parseErrors = append(parseErrors, "PKCS1: "+err.Error())
	}

	if cert, err := x509.ParseCertificate(keyDER); err == nil {
		key, ok := cert.PublicKey.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("dulupay public key certificate is not rsa")
		}

		return key, nil
	} else {
		parseErrors = append(parseErrors, "certificate: "+err.Error())
	}

	return nil, fmt.Errorf(
		"unsupported dulupay public key format; expected PKIX, PKCS1, or certificate RSA public key (%s)",
		strings.Join(parseErrors, "; "),
	)
}

func decodeDuluPayKey(value string) ([]byte, error) {
	value = strings.TrimSpace(strings.ReplaceAll(value, `\n`, "\n"))
	if value == "" {
		return nil, errors.New("empty key")
	}

	if block, _ := pem.Decode([]byte(value)); block != nil {
		return block.Bytes, nil
	}

	value = strings.NewReplacer("\r", "", "\n", "", "\t", "", " ", "").Replace(value)
	keyDER, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("not PEM and not base64 DER: %w", err)
	}

	return keyDER, nil
}

func formatDuluPayMoney(amount float64) string {
	return decimal.NewFromFloat(amount).Round(2).StringFixed(2)
}

func moneyEqual(a, b float64) bool {
	return decimal.NewFromFloat(a).Round(2).Equal(decimal.NewFromFloat(b).Round(2))
}
