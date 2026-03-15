#!/usr/bin/env bash
set -euo pipefail

TARGET_WORKSPACE="${1:-$HOME/.openclaw/workspace}"
TARGET_DIR="$TARGET_WORKSPACE/skills/talent-intelligence-agent"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/skill/talent-intelligence-agent"

mkdir -p "$TARGET_WORKSPACE/skills"
rm -rf "$TARGET_DIR"
cp -R "$SRC_DIR" "$TARGET_DIR"

echo "Installed talent-intelligence-agent to: $TARGET_DIR"
echo "Next: export TALENT_INTEL_BACKEND_URL / TALENT_INTEL_LLM_BASE_URL / TALENT_INTEL_LLM_API_KEY if needed."
