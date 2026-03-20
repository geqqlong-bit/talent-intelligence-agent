import http from 'http';
import crypto from 'crypto';

const PORT = Number(process.env.TALENT_INTEL_MOCK_LLM_PORT || 8999);
const HOST = process.env.TALENT_INTEL_MOCK_LLM_HOST || '127.0.0.1';
const API_KEY = process.env.TALENT_INTEL_MOCK_LLM_API_KEY || 'test-key';

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function extractPayloadFromMessages(messages = []) {
  const userMessage = messages.find((entry) => entry?.role === 'user' && typeof entry?.content === 'string');
  if (!userMessage) return {};
  const marker = 'requestJson:\n';
  const index = userMessage.content.indexOf(marker);
  if (index === -1) return {};
  const remainder = userMessage.content.slice(index + marker.length);
  const firstBrace = remainder.indexOf('{');
  if (firstBrace === -1) return {};

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let i = firstBrace; i < remainder.length; i += 1) {
    const ch = remainder[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  const rawJson = (endIndex === -1 ? remainder.slice(firstBrace) : remainder.slice(firstBrace, endIndex)).trim();
  try {
    return JSON.parse(rawJson);
  } catch {
    return {};
  }
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function quoteOrInsufficient(values = [], fallbackLabel = '信息不足') {
  const filtered = toArray(values).map((item) => String(item)).filter(Boolean);
  return filtered.length ? filtered.slice(0, 2) : [fallbackLabel];
}

function buildEvidenceDimension({ key, label, judgement, confidence, evidenceQuotes, missingInformation = [] }) {
  const usableQuotes = quoteOrInsufficient(evidenceQuotes);
  const insufficient = usableQuotes.length === 1 && usableQuotes[0] === '信息不足';
  return {
    key,
    label,
    judgement: insufficient ? '信息不足：缺少足够简历证据支持判断。' : judgement,
    confidence: insufficient ? '低' : confidence,
    evidenceQuotes: usableQuotes,
    evidenceStatus: insufficient ? '信息不足' : (usableQuotes.length >= 2 ? '证据充分' : '证据有限'),
    missingInformation: insufficient ? (missingInformation.length ? missingInformation : ['需要补充可验证的项目、职责或结果描述']) : missingInformation
  };
}

function buildCandidateAssessment(payload = {}) {
  const ctx = payload.searchContext || {};
  const candidate = payload.candidateData || payload.stageContext?.candidate || {};
  const name = candidate.name || ctx.candidateName || 'Sample Candidate';
  const summary = candidate.summary || ctx.candidateSummary || '';
  const experience = candidate.experience || candidate.details?.experience || '';
  const highlights = toArray(candidate.highlights);
  const concerns = toArray(candidate.concerns);
  const skills = toArray(candidate.skills);
  const notes = toArray([candidate.interviewerNotes, ctx.interviewerNotes]);

  return {
    assessmentType: 'trusted_assessment',
    candidateName: name,
    recommendation: highlights.length >= 2 ? '建议推进' : '谨慎推进',
    summary: summary || '信息不足：简历摘要较少，建议结合完整履历再判断。',
    confidence: {
      score: highlights.length >= 2 ? 0.78 : 0.62,
      label: highlights.length >= 2 ? 'medium-high' : 'medium',
      rationale: 'Trusted assessment 依赖简历证据密度；当前结论适合继续验证，不适合直接终判。'
    },
    dimensions: [
      buildEvidenceDimension({
        key: 'relevant_experience',
        label: 'Rubric｜相关经历匹配',
        judgement: `${name} 具备与目标岗位相邻的经历，可继续核实深度与迁移性。`,
        confidence: summary || experience ? '中' : '低',
        evidenceQuotes: [summary, experience],
        missingInformation: ['缺少每段经历的职责边界与起止时间']
      }),
      buildEvidenceDimension({
        key: 'achievement_ownership',
        label: 'Rubric｜业绩与 owner 程度',
        judgement: '简历里出现了可验证结果线索，但仍需核实是否为本人主导。',
        confidence: highlights.length >= 2 ? '中' : '低',
        evidenceQuotes: highlights,
        missingInformation: ['需要补充目标、动作、结果、本人角色']
      }),
      buildEvidenceDimension({
        key: 'domain_alignment',
        label: 'Rubric｜领域与能力对口度',
        judgement: skills.length ? '技能标签与岗位要求存在重合，但要区分写过与真正做深。' : '信息不足：缺少明确技能与领域证据。',
        confidence: skills.length >= 2 ? '中' : '低',
        evidenceQuotes: skills,
        missingInformation: ['需要补充核心技能使用场景与熟练度']
      }),
      buildEvidenceDimension({
        key: 'risk_flags',
        label: 'Rubric｜主要风险信号',
        judgement: concerns.length ? '简历/备注中已有风险信号，建议在初访里先核实。' : '信息不足：未看到明确风险描述，不代表没有风险。',
        confidence: concerns.length ? '中' : '低',
        evidenceQuotes: concerns.length ? concerns : notes,
        missingInformation: ['需要补充离职动机、薪酬预期、管理跨度或城市意愿']
      })
    ],
    evidence: [
      {
        claim: '候选人具备跨团队推进和交付经历',
        support: highlights[0] || summary || '信息不足',
        quality: highlights.length >= 2 ? 'medium' : 'low'
      },
      {
        claim: '候选人存在需要面试补证的 ownership 风险',
        support: concerns[0] || notes[0] || '信息不足',
        quality: concerns.length ? 'medium' : 'low'
      }
    ],
    overallRisks: [
      {
        label: 'Evidence｜证据密度不足',
        detail: highlights.length >= 2 ? '虽然有结果线索，但仍缺少完整业务背景与本人贡献拆解。' : '简历对结果与职责写得偏概括，容易高估匹配度。',
        confidence: highlights.length >= 2 ? '中' : '高',
        evidenceQuotes: quoteOrInsufficient([...highlights, ...notes]),
        evidenceStatus: highlights.length || notes.length ? '证据有限' : '信息不足'
      }
    ],
    followUpQuestions: [
      '请拆一个你亲自主导的项目：目标、资源、动作、结果分别是什么？',
      '你在上一段经历里真正拍板或 owner 的部分是什么？',
      '如果加入当前岗位，前 90 天你会先解决哪三件事？'
    ]
  };
}

function renderMockMarkdown(body = {}) {
  const payload = extractPayloadFromMessages(body.messages || []);
  const ctx = payload.searchContext || {};
  const templateId = payload.templateId || 'unknown_template';
  const companies = Array.isArray(ctx.targetCompanies) && ctx.targetCompanies.length
    ? ctx.targetCompanies.map((item) => `- ${item}`).join('\n')
    : '- TBD';
  const mustHaveSkills = Array.isArray(ctx.mustHaveSkills) && ctx.mustHaveSkills.length
    ? ctx.mustHaveSkills.map((item) => `- ${item}`).join('\n')
    : '- TBD';

  return [
    `# 模拟远程人才情报报告｜${ctx.roleTitle || 'TBD'}`,
    '',
    '## 结论',
    '',
    `- 该报告由本地 mock OpenAI-compatible provider 生成，用于离线集成测试。`,
    `- Template: ${templateId}`,
    `- Project: ${ctx.projectName || 'TBD'}`,
    `- Objective: ${ctx.objective || 'TBD'}`,
    '',
    '## 角色摘要',
    '',
    `- Role Title: ${ctx.roleTitle || 'TBD'}`,
    `- Location: ${ctx.location || 'TBD'}`,
    `- Salary Range: ${ctx.salaryRange || 'TBD'}`,
    '',
    '## Target Companies',
    '',
    companies,
    '',
    '## Must-Have Skills',
    '',
    mustHaveSkills,
    '',
    '## Mock Provider Notes',
    '',
    '- No external network was used.',
    '- This response is deterministic enough for local harness validation.'
  ].join('\n');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'talent-intelligence-mock-openai-provider',
      status: 'healthy',
      host: HOST,
      port: PORT
    });
  }

  if (req.method === 'POST' && (req.url === '/v1/chat/completions' || req.url === '/chat/completions')) {
    const authorization = req.headers.authorization || '';
    if (API_KEY && authorization !== `Bearer ${API_KEY}`) {
      return json(res, 401, {
        error: {
          message: 'Unauthorized mock request',
          code: 'unauthorized'
        }
      });
    }

    const rawBody = await collectBody(req);
    let body;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return json(res, 400, {
        error: {
          message: 'Invalid JSON body',
          code: 'invalid_json'
        }
      });
    }

    // Check if JSON mode is requested
    const jsonResponse = body.response_format && 
                         (body.response_format.type === 'json_object' || 
                          body.response_format === 'json_object');
    
    let content;
    if (jsonResponse) {
      // Generate a mock JSON response for candidate assessment or other structured outputs
      const payload = extractPayloadFromMessages(body.messages || []);
      const ctx = payload.searchContext || {};
      
      // Generate appropriate JSON response based on template
      let structuredResponse = {};
      switch (payload.templateId) {
        case 'candidate_assessment_cn':
          structuredResponse = buildCandidateAssessment(payload);
          break;
        case 'jd_diagnosis_cn':
          structuredResponse = {
            completenessScore: Math.floor(Math.random() * 21) + 80,
            clarityScore: Math.floor(Math.random() * 21) + 80,
            marketCompetitive: true,
            suggestedImprovements: [
              'Add more specific technical requirements',
              'Clarify reporting structure',
              'Include growth opportunities'
            ],
            marketPositioning: 'Competitive position in the market for this role',
            recommendations: [
              'Consider adding remote work options',
              'Specify required years of experience more clearly'
            ]
          };
          break;
        default:
          // Generic structured response
          structuredResponse = {
            templateId: payload.templateId || 'unknown',
            mockData: true,
            responseType: 'structured_json',
            content: renderMockMarkdown(body)
          };
      }
      
      content = JSON.stringify(structuredResponse, null, 2);
    } else {
      content = renderMockMarkdown(body);
    }
    
    const completionTokens = Math.max(64, Math.ceil(content.length / 5));
    const promptTokens = Math.max(64, Math.ceil(rawBody.length / 4));

    return json(res, 200, {
      id: `chatcmpl_mock_${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'mock-model',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content
          }
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    });
  }

  return json(res, 404, {
    error: {
      message: 'Not found',
      code: 'not_found'
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-openai-provider] listening on http://${HOST}:${PORT}`);
});
