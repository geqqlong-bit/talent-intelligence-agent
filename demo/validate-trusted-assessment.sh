#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${TALENT_INTEL_PORT:-28789}"
MOCK_PORT="${TALENT_INTEL_MOCK_LLM_PORT:-29099}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
MOCK_URL="http://127.0.0.1:${MOCK_PORT}/v1"
TMP_DIR="$(mktemp -d)"
BACKEND_LOG="${TMP_DIR}/backend.log"
MOCK_LOG="${TMP_DIR}/mock.log"
REQUEST_JSON="${TMP_DIR}/request.json"
RESPONSE_JSON="${TMP_DIR}/response.json"

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
  for _ in {1..80}; do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 0.2
  done
  echo "[trusted-assessment] ${label} did not become ready: ${url}" >&2
  return 1
}

pushd "$ROOT_DIR" >/dev/null

node --input-type=module - "examples/run-request-trusted-assessment.json" "$REQUEST_JSON" "$MOCK_URL" <<'NODE'
import fs from 'fs';
const [inputPath, outputPath, mockUrl] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
payload.runtime.baseUrl = mockUrl;
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
NODE

echo "[trusted-assessment] Starting mock provider on port ${MOCK_PORT}..."
TALENT_INTEL_MOCK_LLM_PORT="$MOCK_PORT" node server/mock-openai-provider.mjs >"$MOCK_LOG" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:${MOCK_PORT}/health" "mock provider"

echo "[trusted-assessment] Starting backend on port ${BACKEND_PORT}..."
env \
  TALENT_INTEL_ENABLE_REMOTE_RUNNER=1 \
  TALENT_INTEL_REMOTE_BASE_URL="$MOCK_URL" \
  TALENT_INTEL_REMOTE_API_KEY="test-key" \
  TALENT_INTEL_DEFAULT_MODEL="mock-qwen" \
  TALENT_INTEL_PORT="$BACKEND_PORT" \
  node server/index.mjs >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
wait_for_http "${BACKEND_URL}/health" "backend"

echo "[trusted-assessment] Running trusted assessment request..."
curl -fsS -X POST "${BACKEND_URL}/api/talent-intelligence/run" \
  -H 'Content-Type: application/json' \
  --data @"$REQUEST_JSON" >"$RESPONSE_JSON"

node --input-type=module - "$RESPONSE_JSON" <<'NODE'
import fs from 'fs';
const [responsePath] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
function assert(condition, message) {
  if (!condition) {
    console.error(`[trusted-assessment] ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}
assert(data.ok === true, 'response.ok should be true');
assert(data.metadata?.apiVersion === 'v0.11', 'apiVersion should be v0.11');
assert(data.run?.runnerId === 'openai-chat', 'runnerId should stay on openai-chat');
assert(typeof data.reportMarkdown === 'string' && data.reportMarkdown.includes('置信度'), 'report should include confidence markers');
assert(data.reportMarkdown.includes('Rubric｜'), 'report should include rubric markers');
assert(data.reportMarkdown.includes('Evidence｜'), 'report should include evidence markers');
console.log('[trusted-assessment] Validation passed');
console.log(`[trusted-assessment] requestId=${data.requestId}`);
console.log(`[trusted-assessment] runId=${data.run?.id}`);
console.log(`[trusted-assessment] artifactCount=${data.run?.artifactCount}`);
console.log('[trusted-assessment] Found rubric + evidence + confidence in final report');
NODE

popd >/dev/null
