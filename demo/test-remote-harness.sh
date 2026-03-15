#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${TALENT_INTEL_PORT:-18788}"
MOCK_PORT="${TALENT_INTEL_MOCK_LLM_PORT:-18999}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
MOCK_URL="http://127.0.0.1:${MOCK_PORT}/v1"
TMP_DIR="$(mktemp -d)"
BACKEND_LOG="${TMP_DIR}/backend.log"
MOCK_LOG="${TMP_DIR}/mock.log"
RESPONSE_JSON="${TMP_DIR}/response.json"
REQUEST_JSON="${TMP_DIR}/run-request.json"

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "${BACKEND_PID}" >/dev/null 2>&1 || true; fi
  if [[ -n "${MOCK_PID:-}" ]]; then kill "${MOCK_PID}" >/dev/null 2>&1 || true; fi
  wait "${BACKEND_PID:-}" >/dev/null 2>&1 || true
  wait "${MOCK_PID:-}" >/dev/null 2>&1 || true
  rm -rf "${TMP_DIR}"
  exit "$exit_code"
}
trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-50}"
  local sleep_seconds="${4:-0.2}"

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "[remote-harness] ${label} did not become ready: ${url}" >&2
  return 1
}

pushd "$ROOT_DIR" >/dev/null

node --input-type=module - "$REQUEST_JSON" "$MOCK_URL" <<'NODE'
import fs from 'fs';

const [outputPath, mockUrl] = process.argv.slice(2);
const template = JSON.parse(fs.readFileSync('examples/run-request-remote-mock.json', 'utf8'));
template.runtime.baseUrl = mockUrl;
fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));
NODE

TALENT_INTEL_MOCK_LLM_PORT="$MOCK_PORT" node server/mock-openai-provider.mjs >"$MOCK_LOG" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:${MOCK_PORT}/health" "mock provider"

env \
  TALENT_INTEL_ENABLE_REMOTE_RUNNER=1 \
  TALENT_INTEL_REMOTE_BASE_URL="$MOCK_URL" \
  TALENT_INTEL_REMOTE_API_KEY="test-key" \
  TALENT_INTEL_DEFAULT_MODEL="mock-qwen" \
  TALENT_INTEL_PORT="$BACKEND_PORT" \
  node server/index.mjs >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
wait_for_http "${BACKEND_URL}/health" "backend"

curl -fsS -X POST "${BACKEND_URL}/api/talent-intelligence/run" \
  -H 'Content-Type: application/json' \
  --data @"$REQUEST_JSON" \
  >"$RESPONSE_JSON"

node --input-type=module - "$RESPONSE_JSON" <<'NODE'
import fs from 'fs';

const responsePath = process.argv[2];
const data = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    console.error(`[remote-harness] ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

assert(data.ok === true, 'response.ok must be true');
assert(data.run?.runnerId === 'openai-chat', `expected run.runnerId=openai-chat, got ${data.run?.runnerId}`);
assert(data.engine?.runnerId === 'openai-chat', `expected engine.runnerId=openai-chat, got ${data.engine?.runnerId}`);
assert(data.metadata?.fallbackApplied === false, 'remote harness should not fallback');
assert(data.orchestration?.execution?.remote?.succeeded === true, 'remote execution must succeed');
assert(String(data.reportMarkdown || '').includes('本地 mock OpenAI-compatible provider'), 'reportMarkdown should contain mock provider marker');

console.log('[remote-harness] PASS');
console.log(`[remote-harness] runId=${data.run?.id}`);
console.log(`[remote-harness] artifacts=${data.artifacts?.rootDir || 'n/a'}`);
NODE

popd >/dev/null
