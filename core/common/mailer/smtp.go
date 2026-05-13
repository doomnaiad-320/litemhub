package mailer

import (
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"

	"github.com/labring/aiproxy/core/common/config"
)

func SendVerificationCodeEmail(to, code string, expiresMinutes int64) error {
	host := strings.TrimSpace(config.SMTPHost)
	if host == "" {
		return fmt.Errorf("smtp host is not configured")
	}

	from := strings.TrimSpace(config.SMTPFrom)
	if from == "" {
		from = strings.TrimSpace(config.SMTPUsername)
	}
	if from == "" {
		return fmt.Errorf("smtp from address is not configured")
	}

	recipient, err := mail.ParseAddress(strings.TrimSpace(to))
	if err != nil {
		return fmt.Errorf("invalid recipient email: %w", err)
	}

	fromAddress := mail.Address{Address: from}
	if name := strings.TrimSpace(config.SMTPFromName); name != "" {
		fromAddress.Name = name
	}

	subject := mime.QEncoding.Encode("utf-8", "LiteMHub 注册验证码")
	body := fmt.Sprintf(
		"你的 LiteMHub 注册验证码是 %s。\r\n\r\n验证码有效期 %d 分钟，请尽快完成注册。\r\n如果这不是你发起的操作，可以忽略这封邮件。\r\n",
		code,
		expiresMinutes,
	)

	message := strings.Join([]string{
		"From: " + fromAddress.String(),
		"To: " + recipient.String(),
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		body,
	}, "\r\n")

	var auth smtp.Auth
	username := strings.TrimSpace(config.SMTPUsername)
	password := config.SMTPPassword
	if username != "" || password != "" {
		auth = smtp.PlainAuth("", username, password, host)
	}

	port := config.SMTPPort
	if port <= 0 {
		port = 587
	}

	return smtp.SendMail(
		net.JoinHostPort(host, strconv.FormatInt(port, 10)),
		auth,
		from,
		[]string{recipient.Address},
		[]byte(message),
	)
}
