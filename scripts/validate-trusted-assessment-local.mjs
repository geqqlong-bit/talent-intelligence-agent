#!/usr/bin/env node

/**
 * Local validation script for v0.11 trusted assessment flow.
 * Validates that the backend properly handles rubric + evidence + confidence requirements.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function validateTrustedAssessment() {
  console.log('[trusted-assessment-validator] Starting validation of v0.11 trusted assessment flow...');
  
  // Read the example request and response
  const requestPath = path.join(rootDir, 'examples', 'run-request-trusted-assessment.json');
  const responsePath = path.join(rootDir, 'examples', 'run-response-trusted-assessment.json');
  
  try {
    const requestContent = await fs.readFile(requestPath, 'utf8');
    const responseContent = await fs.readFile(responsePath, 'utf8');
    
    const request = JSON.parse(requestContent);
    const response = JSON.parse(responseContent);
    
    // Validate request structure
    console.log('[trusted-assessment-validator] Validating request structure...');
    validateRequest(request);
    
    // Validate response structure
    console.log('[trusted-assessment-validator] Validating response structure...');
    validateResponse(response);
    
    // Validate trusted assessment specific elements
    console.log('[trusted-assessment-validator] Validating trusted assessment elements...');
    validateTrustedAssessmentElements(response);
    
    console.log('\n✅ All validations passed!');
    console.log(`✅ API Version: ${response.metadata.apiVersion}`);
    console.log(`✅ Request ID: ${response.requestId}`);
    console.log(`✅ Run ID: ${response.run.id}`);
    console.log(`✅ Total candidates assessed: ${response.candidateAssessment.totalCandidates}`);
    console.log(`✅ Successful assessments: ${response.candidateAssessment.successfulAssessments}`);
    
    // Print some key assessment details
    if (response.candidateAssessment.assessments && response.candidateAssessment.assessments.length > 0) {
      const assessment = response.candidateAssessment.assessments[0];
      console.log(`\n📋 Assessment for: ${assessment.candidateName}`);
      console.log(`🎯 Recommendation: ${assessment.recommendation}`);
      console.log(`💯 Confidence Score: ${assessment.confidence.score} (${assessment.confidence.label})`);
      
      console.log('\n🔍 Assessment Dimensions:');
      assessment.dimensions.forEach(dim => {
        console.log(`  • ${dim.label}: ${dim.confidence} confidence`);
        console.log(`    Evidence Status: ${dim.evidenceStatus}`);
        console.log(`    Evidence Quotes: ${dim.evidenceQuotes.length} items`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    process.exit(1);
  }
}

function validateRequest(request) {
  if (!request.templateId) throw new Error('Missing templateId in request');
  if (request.templateId !== 'candidate_assessment_cn') {
    throw new Error(`Expected templateId 'candidate_assessment_cn', got '${request.templateId}'`);
  }
  
  if (!request.searchContext || !request.searchContext.roleTitle) {
    throw new Error('Missing roleTitle in searchContext');
  }
  
  if (!request.searchContext.candidates || request.searchContext.candidates.length === 0) {
    throw new Error('Expected candidates array in searchContext');
  }
  
  if (!request.runtime || !request.runtime.jsonMode) {
    console.warn('⚠️  jsonMode not set in runtime - this may affect trusted assessment validation');
  }
  
  console.log('✅ Request structure validated');
}

function validateResponse(response) {
  if (response.ok !== true) throw new Error('Response ok should be true');
  if (response.metadata?.apiVersion !== 'v0.11') {
    throw new Error(`Expected apiVersion 'v0.11', got '${response.metadata?.apiVersion}'`);
  }
  
  if (!response.reportMarkdown) throw new Error('Missing reportMarkdown in response');
  if (!response.candidateAssessment) throw new Error('Missing candidateAssessment in response');
  
  console.log('✅ Response structure validated');
}

function validateTrustedAssessmentElements(response) {
  const assessment = response.candidateAssessment;
  
  if (assessment.mode !== 'batch') {
    console.warn(`⚠️  Expected batch mode, got: ${assessment.mode}`);
  }
  
  if (!Array.isArray(assessment.assessments) || assessment.assessments.length === 0) {
    throw new Error('Expected assessments array with at least one item');
  }
  
  // Check first assessment for trusted assessment properties
  const firstAssessment = assessment.assessments[0];
  
  if (firstAssessment.assessmentType !== 'trusted_assessment') {
    throw new Error(`Expected assessmentType 'trusted_assessment', got '${firstAssessment.assessmentType}'`);
  }
  
  // Validate confidence structure
  if (!firstAssessment.confidence || typeof firstAssessment.confidence !== 'object') {
    throw new Error('Missing or invalid confidence object');
  }
  
  if (typeof firstAssessment.confidence.score !== 'number') {
    throw new Error('Missing or invalid confidence.score');
  }
  
  if (typeof firstAssessment.confidence.label !== 'string') {
    throw new Error('Missing or invalid confidence.label');
  }
  
  // Validate dimensions structure
  if (!Array.isArray(firstAssessment.dimensions)) {
    throw new Error('Missing or invalid dimensions array');
  }
  
  firstAssessment.dimensions.forEach((dimension, index) => {
    if (!dimension.key) throw new Error(`Dimension ${index} missing key`);
    if (!dimension.label) throw new Error(`Dimension ${index} missing label`);
    if (!dimension.judgement) throw new Error(`Dimension ${index} missing judgement`);
    if (!dimension.confidence) throw new Error(`Dimension ${index} missing confidence`);
    if (!Array.isArray(dimension.evidenceQuotes)) throw new Error(`Dimension ${index} evidenceQuotes not an array`);
    if (!Array.isArray(dimension.missingInformation)) throw new Error(`Dimension ${index} missingInformation not an array`);
  });
  
  // Validate evidence structure
  if (!Array.isArray(firstAssessment.evidence)) {
    throw new Error('Missing or invalid evidence array');
  }
  
  firstAssessment.evidence.forEach((evidenceItem, index) => {
    if (!evidenceItem.claim) throw new Error(`Evidence item ${index} missing claim`);
    if (!evidenceItem.support) throw new Error(`Evidence item ${index} missing support`);
    if (!evidenceItem.quality) throw new Error(`Evidence item ${index} missing quality`);
  });
  
  // Validate presence of rubric, evidence, and confidence markers in report
  const report = response.reportMarkdown.toLowerCase();
  if (!report.includes('rubric')) {
    console.warn("⚠️  Report doesn't contain 'rubric' - may affect trusted assessment validation");
  }
  if (!report.includes('evidence')) {
    console.warn("⚠️  Report doesn't contain 'evidence' - may affect trusted assessment validation");
  }
  if (!report.includes('置信度') && !report.includes('confidence')) {
    console.warn("⚠️  Report doesn't contain '置信度' or 'confidence' - may affect trusted assessment validation");
  }
  
  console.log('✅ Trusted assessment elements validated');
}

// Run validation if this script is executed directly
if (process.argv[1] === __filename) {
  validateTrustedAssessment().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { validateTrustedAssessment, validateRequest, validateResponse, validateTrustedAssessmentElements };