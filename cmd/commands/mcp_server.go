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

package commands

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/spf13/cobra"

	mcpserver "github.com/numaproj/numaflow/pkg/mcp"
	sharedutil "github.com/numaproj/numaflow/pkg/shared/util"
)

func NewMCPServerCommand() *cobra.Command {
	var (
		serverURL       string
		baseHref        string
		insecureSkipTLS bool
	)
	token := sharedutil.LookupEnvStringOr("NUMAFLOW_API_TOKEN", "")
	command := &cobra.Command{
		Use:   "mcp-server",
		Short: "Start the Numaflow MCP server over stdio",
		RunE: func(_ *cobra.Command, _ []string) error {
			transport := http.DefaultTransport.(*http.Transport).Clone()
			if insecureSkipTLS {
				transport.TLSClientConfig = &tls.Config{
					MinVersion:         tls.VersionTLS12,
					InsecureSkipVerify: true, //nolint:gosec // Explicit development-only flag.
				}
			}
			httpClient := &http.Client{
				Transport: transport,
				Timeout:   30 * time.Second,
			}
			api, err := mcpserver.NewAPIClient(serverURL, baseHref, token, httpClient)
			if err != nil {
				return fmt.Errorf("create API v2 client: %w", err)
			}
			return mcpserver.ServeStdio(api)
		},
	}
	command.Flags().StringVar(&serverURL, "server-url", sharedutil.LookupEnvStringOr("NUMAFLOW_API_URL", ""), "Numaflow server URL.")
	command.Flags().StringVar(&baseHref, "base-href", sharedutil.LookupEnvStringOr("NUMAFLOW_API_BASE_HREF", ""), "Optional Numaflow server base href.")
	command.Flags().BoolVar(&insecureSkipTLS, "insecure-skip-tls-verify", sharedutil.LookupEnvBoolOr("NUMAFLOW_API_INSECURE_SKIP_TLS_VERIFY", false), "Skip server certificate verification for local development only.")
	return command
}
