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
  const rulesIndex = remainder.indexOf('\n\nRequired output rules:');
  const rawJson = (rulesIndex === -1 ? remainder : remainder.slice(0, rulesIndex)).trim();
  try {
    return JSON.parse(rawJson);
  } catch {
    return {};
  }
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

    const content = renderMockMarkdown(body);
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
