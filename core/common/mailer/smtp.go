package mailer

import (
	"crypto/tls"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"

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

	username := strings.TrimSpace(config.SMTPUsername)
	password := config.SMTPPassword

	port := config.SMTPPort
	if port <= 0 {
		port = 587
	}
	addr := net.JoinHostPort(host, strconv.FormatInt(port, 10))

	if useSMTPImplicitTLS(config.SMTPTLSMode, port) {
		return sendMailImplicitTLS(addr, host, newSMTPImplicitTLSAuth(username, password), from, []string{recipient.Address}, []byte(message))
	}

	return smtp.SendMail(
		addr,
		newSMTPAuth(host, username, password),
		from,
		[]string{recipient.Address},
		[]byte(message),
	)
}

func newSMTPAuth(host, username, password string) smtp.Auth {
	if username == "" && password == "" {
		return nil
	}

	return smtp.PlainAuth("", username, password, host)
}

func newSMTPImplicitTLSAuth(username, password string) smtp.Auth {
	if username == "" && password == "" {
		return nil
	}

	return smtpImplicitTLSPlainAuth{
		username: username,
		password: password,
	}
}

func useSMTPImplicitTLS(mode string, port int64) bool {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "ssl", "tls", "implicit", "implicit_tls", "smtps":
		return true
	case "none", "plain", "starttls", "false", "off":
		return false
	default:
		return port == 465 || port == 994
	}
}

type smtpImplicitTLSPlainAuth struct {
	username string
	password string
}

func (a smtpImplicitTLSPlainAuth) Start(_ *smtp.ServerInfo) (string, []byte, error) {
	return "PLAIN", []byte("\x00" + a.username + "\x00" + a.password), nil
}

func (a smtpImplicitTLSPlainAuth) Next(_ []byte, more bool) ([]byte, error) {
	if more {
		return nil, fmt.Errorf("unexpected server challenge")
	}

	return nil, nil
}

func sendMailImplicitTLS(addr, host string, auth smtp.Auth, from string, to []string, msg []byte) error {
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		MinVersion: tls.VersionTLS12,
		ServerName: host,
	})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Close()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	for _, recipient := range to {
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(msg); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
}
