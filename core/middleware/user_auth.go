package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labring/aiproxy/core/common/config"
	"github.com/labring/aiproxy/core/model"
)

const userJWTIssuer = "aiproxy-user"

type UserJWTClaims struct {
	UserID int `json:"user_id"`
	jwt.RegisteredClaims
}

func CreateUserJWT(user *model.AppUser) (string, time.Time, error) {
	if user == nil || user.ID == 0 {
		return "", time.Time{}, errors.New("user is invalid")
	}

	secret := config.GetUserJWTSecret()
	if secret == "" {
		return "", time.Time{}, errors.New("user jwt secret is not set")
	}

	now := time.Now()
	expiresAt := now.Add(time.Duration(config.UserJWTExpireHours) * time.Hour)

	claims := UserJWTClaims{
		UserID: user.ID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    userJWTIssuer,
			Subject:   strconv.Itoa(user.ID),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", time.Time{}, err
	}

	return signedToken, expiresAt, nil
}

func ParseUserJWT(tokenString string) (*UserJWTClaims, error) {
	if strings.TrimSpace(tokenString) == "" {
		return nil, errors.New("no token provided")
	}

	secret := config.GetUserJWTSecret()
	if secret == "" {
		return nil, errors.New("user jwt secret is not set")
	}

	claims := &UserJWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}

		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if !token.Valid || claims.UserID == 0 {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func UserAuth(c *gin.Context) {
	secret := config.GetUserJWTSecret()
	if secret == "" {
		ErrorResponse(c, http.StatusInternalServerError, "user jwt secret is not set")
		c.Abort()
		return
	}

	accessToken := c.Request.Header.Get("Authorization")
	accessToken = strings.TrimSpace(strings.TrimPrefix(accessToken, "Bearer "))
	if accessToken == "" {
		ErrorResponse(c, http.StatusUnauthorized, "unauthorized, no access token provided")
		c.Abort()
		return
	}

	claims, err := ParseUserJWT(accessToken)
	if err != nil {
		ErrorResponse(c, http.StatusUnauthorized, "unauthorized, invalid access token")
		c.Abort()
		return
	}

	user, err := model.GetAppUserByID(claims.UserID)
	if err != nil {
		ErrorResponse(c, http.StatusUnauthorized, "unauthorized, user not found")
		c.Abort()
		return
	}

	if user.Status != model.AppUserStatusEnabled {
		ErrorResponse(c, http.StatusForbidden, "user is disabled")
		c.Abort()
		return
	}

	c.Set(WalletUser, *user)
	c.Next()
}

func GetWalletUser(c *gin.Context) *model.AppUser {
	v := c.MustGet(WalletUser)

	switch user := v.(type) {
	case model.AppUser:
		return &user
	case *model.AppUser:
		return user
	default:
		panic(fmt.Sprintf("wallet user type error: %T, %v", v, v))
	}
}

func GetWalletUserIfExists(c *gin.Context) *model.AppUser {
	v, ok := c.Get(WalletUser)
	if !ok {
		return nil
	}

	switch user := v.(type) {
	case model.AppUser:
		return &user
	case *model.AppUser:
		return user
	default:
		panic(fmt.Sprintf("wallet user type error: %T, %v", v, v))
	}
}

func SetWalletReservation(c *gin.Context, reservation *model.AppWalletReservation) {
	if reservation == nil {
		return
	}

	c.Set(WalletReservation, reservation)
}

func GetWalletReservation(c *gin.Context) *model.AppWalletReservation {
	v := c.MustGet(WalletReservation)

	switch reservation := v.(type) {
	case model.AppWalletReservation:
		return &reservation
	case *model.AppWalletReservation:
		return reservation
	default:
		panic(fmt.Sprintf("wallet reservation type error: %T, %v", v, v))
	}
}

func GetWalletReservationIfExists(c *gin.Context) *model.AppWalletReservation {
	v, ok := c.Get(WalletReservation)
	if !ok {
		return nil
	}

	switch reservation := v.(type) {
	case model.AppWalletReservation:
		return &reservation
	case *model.AppWalletReservation:
		return reservation
	default:
		panic(fmt.Sprintf("wallet reservation type error: %T, %v", v, v))
	}
}
