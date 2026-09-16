/*
Copyright 2022 The Numaproj Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package routes

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/numaproj/numaflow/pkg/shared/logging"
	v1 "github.com/numaproj/numaflow/server/apis/v1"
	"github.com/numaproj/numaflow/server/authn"
	"github.com/numaproj/numaflow/server/authz"
	"github.com/numaproj/numaflow/server/common"
)

// authMiddleware is the middleware for AuthN/AuthZ.
// it ensures the user is authenticated and authorized
// to execute the requested action before sending the request to the api handler.
func authMiddleware(ctx context.Context, authorizer authz.Authorizer, dexAuthenticator authn.Authenticator, localUsersAuthenticator authn.Authenticator, authRouteMap authz.RouteMap) gin.HandlerFunc {
	return authenticatedRouteMiddleware(ctx, authorizer, dexAuthenticator, localUsersAuthenticator, authRouteMap,
		func(c *gin.Context, status int, _ string, detail string) {
			c.JSON(status, v1.NewNumaflowAPIResponse(&detail, nil))
		})
}

type authErrorWriter func(c *gin.Context, status int, code, detail string)

func authenticatedRouteMiddleware(ctx context.Context, authorizer authz.Authorizer, dexAuthenticator authn.Authenticator, localUsersAuthenticator authn.Authenticator, authRouteMap authz.RouteMap, writeError authErrorWriter) gin.HandlerFunc {
	return func(c *gin.Context) {
		log := logging.FromContext(ctx)
		userInfo, err := authenticateRequest(c, dexAuthenticator, localUsersAuthenticator)
		if err != nil {
			writeError(c, http.StatusUnauthorized, "authentication_failed", err.Error())
			c.Abort()
			return
		}
		c.Set(authn.UserInfoContextKey, userInfo)
		// Check if the route requires authorization.
		if authRouteMap.GetRouteFromContext(c) != nil && authRouteMap.GetRouteFromContext(c).RequiresAuthZ {
			// Check if the user is authorized to execute the requested action.
			isAuthorized := authorizer.Authorize(c, userInfo)
			if isAuthorized {
				// If the user is authorized, continue the request.
				c.Next()
			} else {
				// If the user is not authorized, return an error.
				writeError(c, http.StatusForbidden, "authorization_denied", "user is not authorized to execute the requested action")
				c.Abort()
			}
		} else if authRouteMap.GetRouteFromContext(c) != nil && !authRouteMap.GetRouteFromContext(c).RequiresAuthZ {
			// If the route does not require AuthZ, skip the AuthZ check.
			c.Next()
		} else {
			// If the route is not present in the route map, return an error.
			log.Errorw("route not present in routeMap", "route", authz.GetRouteMapKey(c))
			writeError(c, http.StatusForbidden, "route_not_authorized", "Invalid route")
			c.Abort()
		}
	}
}

func authenticateRequest(c *gin.Context, dexAuthenticator authn.Authenticator, localUsersAuthenticator authn.Authenticator) (*authn.UserInfo, error) {
	if authorization := strings.TrimSpace(c.GetHeader("Authorization")); authorization != "" {
		scheme, token, found := strings.Cut(authorization, " ")
		if !found || !strings.EqualFold(scheme, "Bearer") || strings.TrimSpace(token) == "" {
			return nil, fmt.Errorf("invalid Authorization header")
		}
		for _, authenticator := range []authn.Authenticator{dexAuthenticator, localUsersAuthenticator} {
			tokenAuthenticator, ok := authenticator.(authn.TokenAuthenticator)
			if !ok || tokenAuthenticator == nil {
				continue
			}
			userInfo, err := tokenAuthenticator.AuthenticateToken(c.Request.Context(), strings.TrimSpace(token))
			if err == nil {
				return userInfo, nil
			}
		}
		return nil, fmt.Errorf("invalid or expired bearer token")
	}

	loginType, err := c.Cookie(common.LoginCookieName)
	if err != nil {
		return nil, fmt.Errorf("failed to get login type: %v", err)
	}
	switch loginType {
	case "dex":
		userInfo, err := dexAuthenticator.Authenticate(c)
		if err != nil {
			return nil, fmt.Errorf("failed to authenticate user: %v", err)
		}
		return userInfo, nil
	case "local":
		userInfo, err := localUsersAuthenticator.Authenticate(c)
		if err != nil {
			return nil, fmt.Errorf("failed to authenticate user: %v", err)
		}
		return userInfo, nil
	default:
		return nil, fmt.Errorf("unidentified login type received: %v", loginType)
	}
}
