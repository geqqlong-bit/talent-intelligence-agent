# Talent Intelligence Agent v0.9 Changes

## Overview
Version 0.9 introduces multi-candidate assessment capabilities while maintaining full backward compatibility with existing single-candidate workflows.

## Key Changes

### 1. Schema Updates (`server/app/schema.mjs`)
- Updated API version from v0.8 to v0.9
- Added `normalizeCandidates()` function to handle both single and multiple candidates
- Modified `normalizeRequest()` to accept `searchContext.candidates` as an array
- Maintains backward compatibility with legacy single-candidate fields (`candidateName`, `candidateSummary`, etc.)

### 2. Execution Logic Updates (`server/app/execution.mjs`)
- Updated candidate assessment stage to look for candidates in `payload.searchContext.candidates`
- Enhanced parallel processing for multiple candidates with concurrency limiting
- Improved error handling for individual candidate assessments
- Updated result compilation to handle both single and multiple candidate scenarios

### 3. New Features
- **Multi-Candidate Support**: Pass multiple candidates as an array in `searchContext.candidates`
- **Parallel Processing**: Candidate assessments run in parallel (limited to 5 concurrent calls)
- **Individual Assessment Reports**: Each candidate gets a separate assessment
- **Batch Analysis**: Compare multiple candidates in a single workflow execution
- **Backward Compatibility**: Existing single-candidate workflows continue to work unchanged

### 4. Example Files Added
- `examples/run-request-multiple-candidates.json`: Demonstrates the new multi-candidate functionality
- `examples/run-request-single-candidate-backward-compatible.json`: Shows backward compatibility

### 5. Documentation Updates
- Updated README.md with v0.9 features and usage examples
- Updated README.zh-CN.md with Chinese documentation for new features
- Added comprehensive documentation for multi-candidate assessment

## Breaking Changes
- None. Full backward compatibility maintained.

## Migration Guide
- Existing code using single candidates continues to work unchanged
- To use multiple candidates, pass an array of candidate objects in `searchContext.candidates`
- Legacy fields (`candidateName`, `candidateSummary`, etc.) are still supported and converted to a single-item array internally