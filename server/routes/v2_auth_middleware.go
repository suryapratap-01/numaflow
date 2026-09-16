/*
Copyright 2026 The Numaproj Authors.

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

	"github.com/gin-gonic/gin"

	v2 "github.com/numaproj/numaflow/server/apis/v2"
	"github.com/numaproj/numaflow/server/authn"
	"github.com/numaproj/numaflow/server/authz"
)

func v2AuthMiddleware(ctx context.Context, authorizer authz.Authorizer, dexAuthenticator authn.Authenticator, localUsersAuthenticator authn.Authenticator, authRouteMap authz.RouteMap) gin.HandlerFunc {
	return authenticatedRouteMiddleware(ctx, authorizer, dexAuthenticator, localUsersAuthenticator, authRouteMap,
		func(c *gin.Context, status int, code, detail string) {
			v2.WriteProblem(c, status, code, "Request authorization failed", detail, nil)
		})
}
