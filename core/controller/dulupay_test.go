package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCalculateRechargePayAmountStacksDiscountCodeDiscount(t *testing.T) {
	effectiveDiscount := calculateRechargeDiscount(0.9, calculateDiscountCodePayMultiplier(0.1))

	require.Equal(t, 0.81, effectiveDiscount)
	require.Equal(t, 81.0, calculateRechargePayAmount(100, effectiveDiscount))
}

func TestCalculateRechargeDiscountNormalizesInvalidDiscount(t *testing.T) {
	require.Equal(t, 0.8, calculateRechargeDiscount(0, 0.8))
	require.Equal(t, 0.8, calculateRechargeDiscount(1.2, 0.8))
}

func TestCalculateDiscountCodePayMultiplierNormalizesInvalidDiscountRatio(t *testing.T) {
	require.Equal(t, 1.0, calculateDiscountCodePayMultiplier(-0.1))
	require.Equal(t, 1.0, calculateDiscountCodePayMultiplier(1))
}
