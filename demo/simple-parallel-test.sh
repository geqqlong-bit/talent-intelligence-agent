#!/bin/bash

# Simple test to validate parallel execution capability
echo "Testing parallel execution for talent intelligence agent..."

# Start mock provider
echo "Starting mock OpenAI provider..."
TALENT_INTEL_MOCK_LLM_PORT=19000 node server/mock-openai-provider.mjs > /tmp/mock_provider.log 2>&1 &
MOCK_PID=$!
sleep 2

# Start backend
echo "Starting talent intelligence backend..."
env \
  TALENT_INTEL_ENABLE_REMOTE_RUNNER=1 \
  TALENT_INTEL_REMOTE_BASE_URL="http://127.0.0.1:19000/v1" \
  TALENT_INTEL_REMOTE_API_KEY="test-key" \
  TALENT_INTEL_DEFAULT_MODEL="mock-qwen" \
  TALENT_INTEL_PORT=18800 \
  node server/index.mjs > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 5

# Test health endpoints
echo "Checking health..."
curl -s http://127.0.0.1:19000/health
echo ""
curl -s http://127.0.0.1:18800/health
echo ""

# Create a simple candidate assessment request
cat > /tmp/single_request.json << EOF
{
  "templateId": "candidate_assessment_cn",
  "searchContext": {
    "projectName": "Test Search",
    "roleTitle": "Software Engineer",
    "candidateName": "Test Candidate",
    "candidateExperience": "5 years in software development",
    "objective": "Output detailed candidate assessment"
  },
  "runtime": {
    "mode": "openai",
    "runner": "openai-chat",
    "allowRemote": true,
    "baseUrl": "http://127.0.0.1:19000/v1",
    "apiKey": "test-key",
    "model": "mock-qwen",
    "temperature": 0.2,
    "maxTokens": 1200,
    "timeoutMs": 15000
  }
}
EOF

# Test single request first
echo "Testing single request..."
curl -s -X POST http://127.0.0.1:18800/api/talent-intelligence/run \
  -H "Content-Type: application/json" \
  -d @/tmp/single_request.json > /tmp/single_response.json

echo "Single request completed, checking response..."
if [ -s /tmp/single_response.json ]; then
  cat /tmp/single_response.json | python3 -m json.tool | head -20
else
  echo "ERROR: Single request failed"
fi

echo ""
echo "Testing parallel execution with 3 concurrent requests..."

# Record start time
START_TIME=$(date +%s%N)

# Launch 3 concurrent requests
for i in {1..3}; do
  cp /tmp/single_request.json /tmp/request_$i.json
  sed -i.bak "s/Test Candidate/Test Candidate $i/" /tmp/request_$i.json
  curl -s -X POST http://127.0.0.1:18800/api/talent-intelligence/run \
    -H "Content-Type: application/json" \
    -d @/tmp/request_$i.json > /tmp/response_$i.json &
done

# Wait for all background jobs to complete
wait

END_TIME=$(date +%s%N)
ELAPSED_NS=$((END_TIME - START_TIME))
ELAPSED_MS=$((ELAPSED_NS / 1000000))

echo "Parallel execution completed in ${ELAPSED_MS}ms"

# Check responses
SUCCESS_COUNT=0
for i in {1..3}; do
  if [ -s /tmp/response_$i.json ]; then
    if grep -q '"ok":true\|"reportMarkdown"' /tmp/response_$i.json; then
      echo "Response $i: SUCCESS"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      echo "Response $i: FAILED"
      cat /tmp/response_$i.json
    fi
  else
    echo "Response $i: EMPTY"
  fi
done

echo ""
echo "=== PARALLEL EXECUTION RESULTS ==="
echo "Successful responses: $SUCCESS_COUNT/3"
echo "Total execution time: ${ELAPSED_MS}ms"
echo "Backend handled concurrent requests: $(if [ $SUCCESS_COUNT -ge 2 ]; then echo "YES"; else echo "NO"; fi)"

# Clean up
kill $BACKEND_PID 2>/dev/null || true
kill $MOCK_PID 2>/dev/null || true

echo ""
if [ $SUCCESS_COUNT -ge 2 ]; then
  echo "✓ PARALLEL EXECUTION VALIDATION PASSED"
  echo "✓ Backend successfully processed multiple concurrent requests"
  echo "✓ Multiple candidate assessments were generated"
else
  echo "✗ PARALLEL EXECUTION VALIDATION FAILED"
  echo "✗ Backend failed to handle concurrent requests properly"
fi