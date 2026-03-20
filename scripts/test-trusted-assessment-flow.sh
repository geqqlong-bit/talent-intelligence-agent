#!/usr/bin/env bash
# Test script to validate the full trusted assessment flow with mock provider

set -euo pipefail

echo "🧪 Testing v0.11 Trusted Assessment Flow"
echo "======================================="

# Run the existing validation script to confirm trusted assessment works
echo "Running trusted assessment validation..."
bash demo/validate-trusted-assessment.sh

echo ""
echo "✅ Trusted assessment validation passed!"
echo ""
echo "📋 Key v0.11 Features Verified:"
echo "- Rubric-based evaluation with explicit criteria"
echo "- Evidence tracking with direct quotes from candidate materials" 
echo "- Confidence scoring for each assessment dimension"
echo "- Risk identification with evidence gaps"
echo "- Structured JSON output with assessment metadata"
echo "- API version v0.11 compliance"
echo ""
echo "🎯 The validation confirms that the full flow (rubric + evidence + confidence) works correctly with mock provider."

# Also run the local validation script to double-check
echo ""
echo "Running additional validation with local script..."
node scripts/validate-trusted-assessment-local.mjs