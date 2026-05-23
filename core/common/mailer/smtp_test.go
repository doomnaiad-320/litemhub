package mailer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUseSMTPImplicitTLSDefaultsToImplicitTLSPorts(t *testing.T) {
	require.True(t, useSMTPImplicitTLS("auto", 465))
	require.True(t, useSMTPImplicitTLS("", 994))
	require.False(t, useSMTPImplicitTLS("auto", 587))
	require.False(t, useSMTPImplicitTLS("", 25))
}

func TestUseSMTPImplicitTLSAllowsExplicitOverride(t *testing.T) {
	require.True(t, useSMTPImplicitTLS("ssl", 587))
	require.True(t, useSMTPImplicitTLS("implicit_tls", 25))
	require.False(t, useSMTPImplicitTLS("starttls", 465))
	require.False(t, useSMTPImplicitTLS("plain", 994))
}
