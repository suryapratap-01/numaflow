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
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMCPPackageHasNoServerOrClusterImports(t *testing.T) {
	_, currentFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	directory := filepath.Dir(currentFile)
	entries, err := os.ReadDir(directory)
	require.NoError(t, err)

	forbidden := []string{
		"github.com/gin-gonic/gin",
		"github.com/numaproj/numaflow/server/apis/v1",
		"github.com/numaproj/numaflow/pkg/apis/",
		"github.com/numaproj/numaflow/pkg/client/",
		"github.com/numaproj/numaflow/pkg/daemon",
		"github.com/numaproj/numaflow/pkg/mvtxdaemon",
		"k8s.io/",
	}
	files := token.NewFileSet()
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		parsedFile, err := parser.ParseFile(files, filepath.Join(directory, entry.Name()), nil, parser.ImportsOnly)
		require.NoError(t, err)
		ast.Inspect(parsedFile, func(node ast.Node) bool {
			importSpec, ok := node.(*ast.ImportSpec)
			if !ok {
				return true
			}
			importPath, err := strconv.Unquote(importSpec.Path.Value)
			require.NoError(t, err)
			for _, prefix := range forbidden {
				require.Falsef(t, strings.HasPrefix(importPath, prefix), "forbidden MCP import %q", importPath)
			}
			return false
		})
	}
}
