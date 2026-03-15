import http from 'http';

const port = Number(process.env.PORT || 8788);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function list(items, fallback = ['TBD']) {
  const normalized = Array.isArray(items) && items.length ? items : fallback;
  return normalized.map((item) => `- ${item}`).join('\n');
}

function renderTemplate(payload) {
  const ctx = payload.searchContext || {};
  const companies = Array.isArray(ctx.targetCompanies) ? ctx.targetCompanies : [];

  const base = {
    title: ctx.roleTitle || 'Unknown Role',
    projectName: ctx.projectName || 'Talent Intelligence Task',
    companyContext: ctx.companyContext || 'Employer context not specified',
    hiringBrief: ctx.hiringBrief || 'No hiring brief provided',
    objective: ctx.objective || 'Produce a recruiting recommendation',
    targetIndustry: ctx.targetIndustry || 'TBD',
    location: ctx.location || 'China',
    salaryRange: ctx.salaryRange || 'TBD'
  };

  switch (payload.templateId) {
    case 'jd_diagnosis_cn':
      return `# JD 诊断报告：${base.title}\n\n## 高管摘要\n- 该岗位的核心任务应围绕“${base.objective}”重新聚焦，而不是把所有需求都堆进 JD。\n- 当前岗位大概率难招的原因是要求可能跨越多个画像，同时缺少优先级排序。\n- 建议先定义必须项、加分项、淘汰项，再决定搜索顺序。\n\n## 岗位背景\n- 项目：${base.projectName}\n- 公司情况：${base.companyContext}\n- 招聘背景：${base.hiringBrief}\n- 地域：${base.location}\n- 薪酬：${base.salaryRange}\n\n## 岗位本质判断\n- 这是一个以结果负责为导向的岗位，而不是纯执行岗。\n- 最关键的是把业务目标映射到真实的人才画像。\n- 如果业务阶段变化快，适应力和跨团队推进力应优先于“完美履历”。\n\n## 建议拆分\n### 必须项\n- 与目标业务强相关的行业经验\n- 能独立承担关键结果的 ownership\n- 有可验证的代表性成果\n\n### 加分项\n- 头部公司或高密度环境背景\n- 从 0 到 1 或从 1 到 10 的阶段性经验\n- 与创始人/业务负责人高频配合经验\n\n### 风险项\n- 标题大但实际职责偏窄\n- 经验看起来强，但迁移性弱\n- 薪酬预期与岗位级别不匹配\n\n## 调整建议\n- 先删掉非必要要求，再看人才池会不会明显扩大。\n- 把第一优先级画像写清楚，避免招聘团队各找各的。\n- 面试问题围绕实际结果与场景判断，不要只问概念。\n`;

    case 'sourcing_strategy_cn':
      return `# 寻访策略报告：${base.title}\n\n## 高管摘要\n- 这个岗位更适合从“${base.targetIndustry}”里做定向搜寻，而不是泛搜。\n- 前两周应优先做目标公司地图 + 布尔搜索验证，快速确认人才池厚度。\n- 如果样本不足，先调整画像边界，不要盲目扩大渠道。\n\n## 搜寻背景\n- 项目：${base.projectName}\n- 公司情况：${base.companyContext}\n- 搜寻目标：${base.objective}\n- 地域：${base.location}\n- 目标行业：${base.targetIndustry}\n\n## 目标公司池\n${list(companies)}\n\n## 渠道优先级\n1. 历史人脉 / 内推网络\n2. 公开职业平台定向搜索\n3. 行业社区 / 内容平台反向定位\n4. 竞争对手组织结构拆解\n\n## 搜索关键词建议\n- ${base.title}\n- ${base.targetIndustry}\n- business owner / strategy / growth / product / commercialization\n\n## Boolean 搜索示例\n\`\`\`text
("${base.title}" OR "相关岗位") AND ("${base.targetIndustry}" OR "相近行业") AND (上海 OR 北京 OR 深圳)
\`\`\`\n\n## 执行建议\n- 先跑 30-50 个样本，看画像是否过窄。\n- 先联系高匹配样本验证市场反馈。\n- 每周复盘：命中率、回复率、推进率。\n`;

    case 'candidate_assessment_cn':
      return `# 候选人评估报告：${base.title}\n\n## 结论\n- 综合建议：**Conditional Yes**\n- 原因：表面履历可能符合，但还需要验证真实 ownership、迁移能力和动机匹配。\n\n## 任务背景\n- 项目：${base.projectName}\n- 公司情况：${base.companyContext}\n- 评估目标：${base.objective}\n- 地域：${base.location}\n- 薪酬：${base.salaryRange}\n\n## 匹配点\n- 行业或职能相关性具备一定基础\n- 有可讨论的项目经历或业绩线索\n- 具备推进下一轮沟通的最低条件\n\n## 风险点\n- 简历表述可能偏包装，证据密度不够\n- 关键成果是否本人主导，需要追问\n- 动机、薪酬、汇报线接受度仍未知\n\n## 建议追问\n- 你负责过的最关键结果是什么？具体怎么做到的？\n- 如果加入这个岗位，前 90 天你会先解决什么？\n- 为什么考虑这个机会？不考虑的边界是什么？\n\n## 下一步建议\n- 进入一次深度访谈，再决定是否正式推荐。\n`;

    case 'search_plan_cn':
    default:
      return `# 招聘推进计划：${base.title}\n\n## 高管摘要\n- 该搜索项目不应只看“找人”，而应同步做画像校准、市场验证和推进节奏管理。\n- 前两周重点不是堆简历，而是判断需求是否真实、人才池是否足够、沟通口径是否有效。\n- 若两周后高匹配样本仍少，应优先调整画像或薪酬，而不是单纯增加渠道。\n\n## 项目背景\n- 项目：${base.projectName}\n- 公司情况：${base.companyContext}\n- 招聘背景：${base.hiringBrief}\n- 目标：${base.objective}\n- 地域：${base.location}\n- 薪酬：${base.salaryRange}\n\n## 周计划\n### Week 1\n- 校准岗位画像与淘汰项\n- 建立目标公司池与关键词体系\n- 产出首批候选样本\n\n### Week 2\n- 验证市场反馈与人才池厚度\n- 复盘命中率与沟通反馈\n- 调整画像与话术\n\n### Week 3-4\n- 集中推进高质量候选人\n- 跟踪面试反馈与风险点\n- 给客户/业务方持续做市场教育\n\n## 风险提示\n- 画像过宽或过理想化\n- 面试标准不一致\n- 决策链路过长，导致候选人流失\n\n## 建议动作\n- 每周一次 search review\n- 用统一模板沉淀候选人判断\n- 把“为什么难招”显性化，不要只催进度\n`;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'talent-intelligence-mock-backend' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/talent-intelligence/run') {
    try {
      const payload = await readJson(req);
      const reportMarkdown = renderTemplate(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, reportMarkdown, templateId: payload.templateId || 'search_plan_cn' }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

server.listen(port, () => {
  console.log(`[mock-backend] listening on http://127.0.0.1:${port}`);
});
