import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createTiaServiceContainer } from '../src/tia/service-container.mjs';

async function createServices() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tia-services-'));
  return createTiaServiceContainer({
    config: {
      cwd,
      reportDir: 'reports'
    }
  });
}

test('scanRisks returns actionable demo alerts', async () => {
  const services = await createServices();
  const result = await services.scanRisks({});

  assert.equal(result.alerts.some((alert) => alert.type === 'candidate_stuck' && alert.candidateName === '李云龙'), true);
  assert.equal(result.alerts.some((alert) => alert.type === 'offer_risk' && alert.candidateName === '张大牛'), true);
  assert.equal(result.alerts.some((alert) => alert.type === 'contract_expiring'), true);
});

test('assessCandidate persists structured assessment and returns similar cases', async () => {
  const services = await createServices();
  const assessment = await services.assessCandidate({
    candidate_id: '33333333-3333-3333-3333-333333333331',
    position_id: '22222222-2222-2222-2222-222222222222'
  });

  assert.equal(typeof assessment.overallScore, 'number');
  assert.equal(Array.isArray(assessment.dimensions), true);
  assert.equal(Array.isArray(assessment.similarCases), true);
  assert.equal(assessment.similarCases.some((item) => item.name === '王码农'), true);

  const candidates = await services.listCandidates('22222222-2222-2222-2222-222222222222');
  const updated = candidates.find((item) => item.id === '33333333-3333-3333-3333-333333333331');

  assert.equal(typeof updated.ai_assessment, 'object');
  assert.equal(Array.isArray(updated.embedding), true);
  assert.equal(updated.embedding.length, 1536);
});

test('generateReport writes markdown and html artifacts', async () => {
  const services = await createServices();
  const result = await services.generateReport({
    candidate_id: '33333333-3333-3333-3333-333333333333'
  });

  assert.match(result.reportMarkdown, /推荐报告/);
  assert.match(result.outputPath, /\.md$/);
  assert.match(result.htmlPath, /\.html$/);

  const [markdown, html] = await Promise.all([
    fs.readFile(result.outputPath, 'utf8'),
    fs.readFile(result.htmlPath, 'utf8')
  ]);

  assert.match(markdown, /王码农/);
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /推荐报告/);
});

test('getWorkbench returns multi-view snapshot for the selected position', async () => {
  const services = await createServices();
  const result = await services.getWorkbench({
    position_id: '22222222-2222-2222-2222-222222222223'
  });

  assert.equal(result.selectedPositionId, '22222222-2222-2222-2222-222222222223');
  assert.equal(result.dashboard.metrics.activePositions >= 4, true);
  assert.equal(Array.isArray(result.bd.clients), true);
  assert.equal(result.bd.clients.some((client) => client.name === '快手电商'), true);
  assert.equal(Array.isArray(result.kanban.columns), true);
  assert.equal(result.kanban.columns.length, 7);
  assert.equal(Array.isArray(result.offer.negotiations), true);
  assert.equal(result.aiWorkbench.actions.some((action) => action.id === 'jd_diagnosis'), true);
});

test('runCopilot returns fallback markdown content when no LLM is configured', async () => {
  const services = await createServices();
  const result = await services.runCopilot({
    task_type: 'jd_diagnosis',
    position_id: '22222222-2222-2222-2222-222222222223',
    candidate_id: '33333333-3333-3333-3333-333333333335',
    notes: '客户本周必须看到 shortlist。'
  });

  assert.equal(result.title, '职位诊断');
  assert.match(result.content, /AI产品总监/);
  assert.match(result.content, /客户本周必须看到 shortlist/);
});

// ===== CLASSIFIER TESTS =====

test('classify routes sourcing request (English) to sourcing_strategy_cn', async () => {
  const services = await createServices();
  const result = await services.classify({
    roleTitle: 'Senior Engineer',
    hiringBrief: 'We need a sourcing strategy for target companies',
    objective: 'Build mapping'
  });

  assert.equal(result.ok, true);
  assert.equal(result.templateId, 'sourcing_strategy_cn');
});

test('classify routes Chinese sourcing keywords correctly', async () => {
  const services = await createServices();
  const result = await services.classify({
    roleTitle: '资深工程师',
    hiringBrief: '需要做人才寻访和目标公司 mapping',
    objective: '建立人才地图'
  });

  assert.equal(result.ok, true);
  assert.equal(result.templateId, 'sourcing_strategy_cn');
});

test('classify routes Chinese assessment keywords correctly', async () => {
  const services = await createServices();
  const result = await services.classify({
    roleTitle: 'AI架构师',
    hiringBrief: '需要对候选人进行能力评估和匹配度测评',
    objective: '候选人评价'
  });

  assert.equal(result.ok, true);
  assert.equal(result.templateId, 'candidate_assessment_cn');
});

test('classify routes candidates field to assessment template', async () => {
  const services = await createServices();
  const result = await services.classify({
    roleTitle: 'Engineer',
    hiringBrief: 'Some brief',
    candidates: [{ name: 'Test' }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.templateId, 'candidate_assessment_cn');
});

test('classify returns confidence level', async () => {
  const services = await createServices();
  const result = await services.classify({
    roleTitle: 'Engineer',
    hiringBrief: 'We need sourcing strategy mapping for target companies with a comprehensive plan',
    objective: 'Build comprehensive sourcing strategy'
  });

  assert.equal(result.ok, true);
  assert.equal(typeof result.confidence, 'string');
});

test('classify returns clarification when roleTitle is missing', async () => {
  const services = await createServices();
  const result = await services.classify({
    hiringBrief: 'Find candidates'
  });

  assert.equal(result.ok, false);
  assert.equal(result.needsClarification, true);
});

test('classify returns clarification for too-short input', async () => {
  const services = await createServices();
  const result = await services.classify({
    roleTitle: 'CTO',
    hiringBrief: 'short'
  });

  assert.equal(result.ok, false);
  assert.equal(result.needsClarification, true);
});

// ===== RAG TESTS =====

test('retrieveKnowledge returns RAG content for CTO role', async () => {
  const services = await createServices();
  const result = await services.retrieveKnowledge({ roleTitle: 'CTO', industry: '' });

  assert.equal(typeof result, 'string');
  assert.match(result, /CTO|cto/i);
  assert.match(result, /Salary Range/);
});

test('retrieveKnowledge returns industry insights', async () => {
  const services = await createServices();
  const result = await services.retrieveKnowledge({ roleTitle: 'random', industry: '电商' });

  assert.equal(typeof result, 'string');
  assert.match(result, /电商/);
});

test('retrieveKnowledge returns empty for unknown role and industry', async () => {
  const services = await createServices();
  const result = await services.retrieveKnowledge({ roleTitle: 'zzz-nonexistent-zzz', industry: 'zzz-none-zzz' });

  assert.equal(result, '');
});

// ===== EXPERT RULES TESTS =====

test('validateOutput detects missing risk section in assessment', async () => {
  const services = await createServices();
  const result = await services.validateOutput({
    markdown: '# Assessment\n\nCandidate is great with strong evidence from 经历.',
    templateId: 'candidate_assessment_cn'
  });

  assert.equal(result.passed, false);
  assert.equal(result.rulesFailed > 0, true);
  assert.match(result.feedback, /Risk|风险/i);
});

test('validateOutput passes valid sourcing strategy', async () => {
  const services = await createServices();
  const result = await services.validateOutput({
    markdown: '# 寻访策略\n\n## 目标公司\n- Company A\n\n## 渠道来源\n- LinkedIn\n\n## 第一周阶段 timeline',
    templateId: 'sourcing_strategy_cn'
  });

  assert.equal(result.passed, true);
  assert.equal(result.rulesChecked, 3);
});

test('validateOutput checks JD diagnosis rules', async () => {
  const services = await createServices();
  const result = await services.validateOutput({
    markdown: '# JD Diagnosis\n\nThis is a simple diagnosis.',
    templateId: 'jd_diagnosis_cn'
  });

  assert.equal(result.passed, false);
  assert.equal(result.rulesChecked, 3);
});

test('validateOutput passes valid JD diagnosis', async () => {
  const services = await createServices();
  const result = await services.validateOutput({
    markdown: '# 职位诊断\n\n## 交付难点\n市场竞争激烈，薪资带偏高。\n\n## 建议\n优化 JD 描述。',
    templateId: 'jd_diagnosis_cn'
  });

  assert.equal(result.passed, true);
});

test('validateOutput checks search plan rules', async () => {
  const services = await createServices();
  const result = await services.validateOutput({
    markdown: '# Search Plan\n\nHere is a plan.',
    templateId: 'search_plan_cn'
  });

  assert.equal(result.passed, false);
  assert.equal(result.rulesChecked, 3);
});

test('validateOutput passes for unknown template', async () => {
  const services = await createServices();
  const result = await services.validateOutput({
    markdown: 'Anything',
    templateId: 'unknown_template'
  });

  assert.equal(result.passed, true);
  assert.equal(result.rulesChecked, 0);
});

// ===== SERVICE CONTAINER TESTS =====

test('service container close() does not throw on demo mode', async () => {
  const services = await createServices();
  await services.close();
  // Should not throw — no PG pool in demo mode
});

test('runtimeInfo returns correct modes in demo mode', async () => {
  const services = await createServices();
  const info = services.runtimeInfo();

  assert.equal(info.storageMode, 'demo-memory');
  assert.equal(info.llmMode, 'fallback-rules');
  assert.equal(info.embeddingMode, 'deterministic-fallback');
});

// ===== BROWSER AUTOMATION TESTS =====

test('browserSearch returns search instructions for liepin', async () => {
  const services = await createServices();
  const result = services.browserSearch({
    platform: 'liepin',
    keywords: 'AI 架构师',
    city: '北京'
  });

  assert.equal(result.platform, 'liepin');
  assert.equal(result.platformName, '猎聘');
  assert.ok(result.searchUrl.includes('AI'));
  assert.ok(result.instructions);
  assert.ok(result.limits);
});

test('browserSearch returns search instructions for maimai', async () => {
  const services = await createServices();
  const result = services.browserSearch({
    platform: 'maimai',
    keywords: '数据科学家'
  });

  assert.equal(result.platform, 'maimai');
  assert.equal(result.platformName, '脉脉');
  assert.ok(result.searchUrl.includes('maimai.cn'));
});

test('browserSearch returns search instructions for boss', async () => {
  const services = await createServices();
  const result = services.browserSearch({
    platform: 'boss',
    keywords: '前端架构师',
    city: '上海'
  });

  assert.equal(result.platform, 'boss');
  assert.equal(result.platformName, 'Boss直聘');
  assert.ok(result.instructions.antiDetection);
});

test('browserSearch throws on missing platform', async () => {
  const services = await createServices();
  assert.throws(() => {
    services.browserSearch({ keywords: 'test' });
  }, /Platform is required/);
});

test('browserExtract normalizes page content from liepin', async () => {
  const services = await createServices();
  const result = services.browserExtract({
    platform: 'liepin',
    pageContent: [
      { name: '张三', company: '阿里巴巴', title: 'AI架构师', experience: '10年', salary: '80K' },
      { name: '李四', company: '字节跳动', title: '算法专家', experience: '8年', salary: '100K' }
    ]
  });

  assert.equal(result.count, 2);
  assert.equal(result.candidates[0].name, '张三');
  assert.equal(result.candidates[0].current_company, '阿里巴巴');
  assert.equal(result.candidates[1].years_experience, 8);
});

test('resumeImport normalizes and returns results in demo mode', async () => {
  const services = await createServices();
  const result = await services.resumeImport({
    platform: 'liepin',
    positionId: '22222222-2222-2222-2222-222222222222',
    candidates: [
      { name: '测试候选人', company: '测试公司', title: '工程师', experience: '5年', salary: '50K' }
    ]
  });

  assert.equal(result.total, 1);
  assert.equal(result.imported, 1);
  assert.ok(result.note.includes('Demo mode'));
});
