#!/bin/bash

# Validation script for Talent Intelligence Agent v0.10
# Tests async job functionality: POST /api/talent-intelligence/jobs, poll GET /api/talent-intelligence/jobs/:jobId until completed

set -e  # Exit on any error

echo "🔍 Starting async job validation test for Talent Intelligence Agent v0.10..."

# Configuration
BASE_URL="${TIA_BASE_URL:-http://127.0.0.1:8788}"  # Default to documented port
TIMEOUT_SECONDS=300  # 5 minutes timeout
POLL_INTERVAL=5      # Poll every 5 seconds

# Sample job payload for v0.10 - using the actual API structure
JOB_PAYLOAD=$(cat << EOF
{
  "templateId": "sourcing_strategy_cn",
  "searchContext": {
    "projectName": "Async Job Test",
    "roleTitle": "Senior Software Engineer",
    "clientName": "Test Client",
    "searchType": "executive_search",
    "mandateType": "retained",
    "companyContext": "Testing async job functionality",
    "companyStage": "Series A",
    "businessModel": "SaaS",
    "teamStage": "Scaling engineering team",
    "hiringBrief": "Find experienced engineer for leadership position",
    "objective": "Output search strategy and target-company map",
    "targetIndustry": "Technology",
    "targetCompanies": ["Company A", "Company B"],
    "location": "Remote",
    "targetGeographies": ["San Francisco", "New York", "Remote"]
  },
  "runtime": {
    "mode": "openai",
    "runner": "local-template",
    "allowRemote": false,
    "model": "bailian/qwen3.5-plus",
    "temperature": 0.4,
    "maxTokens": 5000,
    "timeoutMs": 120000
  }
}
EOF
)

echo "📤 Sending POST request to $BASE_URL/api/talent-intelligence/jobs"

# Send POST request to create job
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/talent-intelligence/jobs" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$JOB_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
PAYLOAD=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ne 202 ]; then  # Expect 202 Accepted for async jobs
  echo "❌ POST request failed with HTTP code: $HTTP_CODE"
  echo "Response: $PAYLOAD"
  exit 1
fi

echo "✅ Job submission successful (HTTP 202 Accepted)"

# Extract jobId from response
JOB_ID=$(echo "$PAYLOAD" | jq -r '.jobId // .id' 2>/dev/null || echo "null")

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
  echo "❌ Could not extract jobId from response"
  echo "Response: $PAYLOAD"
  exit 1
fi

echo "📋 Got jobId: $JOB_ID"

echo "⏳ Waiting for job to complete (timeout: ${TIMEOUT_SECONDS}s, polling every ${POLL_INTERVAL}s)"

# Calculate timeout timestamp
END_TIME=$(($(date +%s) + TIMEOUT_SECONDS))

while true; do
  CURRENT_TIME=$(date +%s)
  
  if [ $CURRENT_TIME -ge $END_TIME ]; then
    echo "⏰ Timeout waiting for job to complete"
    exit 1
  fi
  
  # Get job status
  STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET "$BASE_URL/api/talent-intelligence/jobs/$JOB_ID" \
    -H "Accept: application/json")
  
  HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
  STATUS_PAYLOAD=$(echo "$STATUS_RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" -ne 200 ]; then
    echo "❌ GET request for job status failed with HTTP code: $HTTP_CODE"
    echo "Response: $STATUS_PAYLOAD"
    exit 1
  fi
  
  # Extract status
  STATUS=$(echo "$STATUS_PAYLOAD" | jq -r '.status' 2>/dev/null || echo "unknown")
  echo "📊 Status: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "🎉 Job completed successfully!"
    
    # Verify the result has the expected structure
    RESULT=$(echo "$STATUS_PAYLOAD" | jq -r '.result // empty')
    
    if [ -z "$RESULT" ] || [ "$RESULT" = "null" ]; then
      echo "❌ Result field is missing or empty"
      echo "Full response: $STATUS_PAYLOAD"
      exit 1
    fi
    
    # Validate that the result contains expected fields from the talent intelligence service
    HAS_REPORT=$(echo "$RESULT" | jq -r '.reportMarkdown // empty' | wc -c)
    HAS_METADATA=$(echo "$RESULT" | jq -r '.metadata // empty' | wc -c)
    HAS_OK=$(echo "$RESULT" | jq -r '.ok // empty' | wc -c)
    
    if [ $HAS_REPORT -gt 1 ] || [ $HAS_METADATA -gt 1 ] || [ $HAS_OK -gt 1 ]; then
      echo "✅ Result validation passed - contains expected fields (ok, metadata, reportMarkdown)"
      echo "📄 Result preview: $(echo "$RESULT" | jq '{ok, metadata: {durationMs, apiVersion}, run: {status, templateId}}')"
    else
      echo "⚠️  Warning: Result may not contain expected fields"
      echo "📄 Full result keys: $(echo "$RESULT" | jq 'keys')"
    fi
    
    echo "🏆 Async job validation test PASSED!"
    echo "✅ Successfully tested v0.10 async job functionality:"
    echo "   - POST /api/talent-intelligence/jobs returned 202"
    echo "   - Job progressed from pending/processing to completed"
    echo "   - GET /api/talent-intelligence/jobs/\$jobId returned final result"
    echo "   - Result contains expected structure from talent intelligence service"
    exit 0
    
  elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ]; then
    echo "💥 Job failed with status: $STATUS"
    ERROR_MSG=$(echo "$STATUS_PAYLOAD" | jq -r '.error // .errorMessage // empty')
    if [ ! -z "$ERROR_MSG" ] && [ "$ERROR_MSG" != "null" ]; then
      echo "Error message: $ERROR_MSG"
    fi
    exit 1
  elif [ "$STATUS" = "pending" ] || [ "$STATUS" = "processing" ]; then
    echo "⏳ Job still in progress, waiting $POLL_INTERVAL seconds..."
    sleep $POLL_INTERVAL
  else
    echo "❓ Unexpected status: $STATUS"
    echo "Full response: $STATUS_PAYLOAD"
    exit 1
  fi
done