# Talent Intelligence Agent v0.10 Release Notes

## New Features

### Asynchronous Job Processing
- Added new async endpoints for long-running operations:
  - `POST /api/talent-intelligence/jobs` - Create new async jobs
  - `GET /api/talent-intelligence/jobs/{jobId}` - Check job status
- Implemented job manager with in-memory storage and automatic cleanup
- Background processing for compute-intensive operations

### Webhook Notifications
- Added `webhookUrl` parameter support for async job completion notifications
- Automatic POST requests to webhook URLs when jobs complete
- Support for both successful completion and error notifications

### API Version Updates
- Updated API version from v0.9 to v0.10
- Extended schema endpoint to document new async endpoints
- Added comprehensive documentation for async functionality

## Documentation Updates

### API Documentation
- Created comprehensive API.md documenting v0.10 async endpoints
- Added examples for job creation, status checking, and webhook payloads
- Updated curl examples for all new endpoints
- Documented request/response contracts for async operations

### README Updates
- Updated main README.md with v0.10 feature highlights
- Updated server README.md with v0.10 contract details
- Added information about async processing and webhook capabilities

## Example Files

### New Example Files
- `examples/job-create-request.json` - Example request for async job creation
- `examples/job-create-response.json` - Example response from job creation
- `examples/job-status-response.json` - Example response from job status query
- `examples/webhook-notification.json` - Example webhook payload

## Technical Changes

### Backend Implementation
- Updated routes.mjs with new async endpoints
- Implemented job manager with CRUD operations
- Added webhook triggering functionality
- Enhanced error handling for async operations
- Maintained backward compatibility with existing sync endpoints

### Architecture
- Preserved synchronous `/api/talent-intelligence/run` endpoint for immediate processing
- Added in-memory job store (production version would use database)
- Implemented 30-day automatic cleanup for completed jobs
- Maintained existing multi-stage pipeline and parallel processing capabilities