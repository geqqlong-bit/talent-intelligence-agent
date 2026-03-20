# Async Job Validation Script

## Overview
This script validates the asynchronous job functionality introduced in Talent Intelligence Agent v0.10.

## Purpose
Tests the new async job API endpoints:
- `POST /api/talent-intelligence/jobs` - Creates a new async job
- `GET /api/talent-intelligence/jobs/{jobId}` - Polls for job status until completion

## What the Script Does
1. Sends a POST request to create a new job using the talent intelligence API
2. Extracts the jobId from the response
3. Continuously polls the job status endpoint until the job completes
4. Validates that the final result contains the expected structure
5. Reports whether the async job functionality is working correctly

## Usage
```bash
# Make sure the talent intelligence agent server is running first
cd /path/to/talent-intelligence-agent
npm start  # or however you start the server

# Then run the validation script
./demo/test-async-job.sh

# Or with a custom base URL
TIA_BASE_URL=http://localhost:9000 ./demo/test-async-job.sh
```

## Expected Behavior
- The script will create a sourcing strategy job
- It will poll the job status every 5 seconds for up to 5 minutes
- It validates that the job transitions from pending/processing to completed
- It confirms that the final result contains the expected response structure
- Exits with code 0 on success, 1 on failure