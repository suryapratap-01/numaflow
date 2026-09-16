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

package mcpserver

import (
	mcpsdk "github.com/mark3labs/mcp-go/mcp"
	mcplib "github.com/mark3labs/mcp-go/server"
)

type ToolDefinition struct {
	Tool    mcpsdk.Tool
	Handler mcplib.ToolHandlerFunc
}

func ToolDefinitions(api SummaryAPI) []ToolDefinition {
	return []ToolDefinition{vertexSummaryTool(api)}
}

func NewServer(api SummaryAPI) *mcplib.MCPServer {
	server := mcplib.NewMCPServer("numaflow-mcp", "0.1.0")
	for _, definition := range ToolDefinitions(api) {
		server.AddTool(definition.Tool, definition.Handler)
	}
	return server
}

func ServeStdio(api SummaryAPI) error {
	return mcplib.ServeStdio(NewServer(api))
}
