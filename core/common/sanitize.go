package common

import (
	"net/netip"
	"regexp"
	"strings"
)

var (
	errorMessageURLPattern       = regexp.MustCompile(`(?i)\bhttps?://[^\s"'<>\\]+`)
	errorMessageBracketIPPattern = regexp.MustCompile(`\[[0-9A-Fa-f:.%]+\]`)
	errorMessageIPv4Pattern      = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	errorMessageIPv6Pattern      = regexp.MustCompile(`\b(?:[0-9A-Fa-f]{0,4}:){2,}[0-9A-Fa-f]{0,4}\b`)
)

func SanitizeErrorMessage(message string) string {
	message = errorMessageURLPattern.ReplaceAllString(message, "[redacted_url]")
	message = redactIPMatches(message, errorMessageBracketIPPattern, true)
	message = redactIPMatches(message, errorMessageIPv4Pattern, false)
	message = redactIPMatches(message, errorMessageIPv6Pattern, false)

	return message
}

func redactIPMatches(message string, pattern *regexp.Regexp, trimBrackets bool) string {
	return pattern.ReplaceAllStringFunc(message, func(match string) string {
		ip := match
		if trimBrackets {
			ip = strings.TrimPrefix(strings.TrimSuffix(match, "]"), "[")
		}

		if _, err := netip.ParseAddr(ip); err != nil {
			return match
		}

		return "[redacted_ip]"
	})
}
