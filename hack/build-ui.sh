#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

source $(dirname $0)/library.sh
header "Build UI"

ensure_node
ensure_yarn

build_ui() {
    yarn --cwd ui install
    yarn --cwd ui generate:api-v2
    NODE_OPTIONS="--max-old-space-size=2048" JOBS=max yarn --cwd ui build
}

build_ui