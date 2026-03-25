import { TEMPLATE_IDS } from './schema.mjs';

// Chinese + English keyword sets for each template
const TEMPLATE_KEYWORDS = {
  sourcing_strategy_cn: [
    'sourcing', 'mapping', 'strategy', 'target companies',
    '寻访', '寻源', 'mapping', '目标公司', '企业画像', '人才地图',
    '竞对', '候选人池', '人才池', '定向挖掘'
  ],
  candidate_assessment_cn: [
    'assess', 'evaluate', 'candidate', 'assessment',
    '评估', '评价', '候选人', '面评', '能力', '匹配度',
    '胜任力', '简历', '背调', '测评'
  ],
  search_plan_cn: [
    'plan', 'advisory', 'search plan',
    '规划', '方案', '计划', '搜索方案', '搜寻',
    '项目启动', '立项', '执行方案'
  ]
};

/**
 * Classify a hiring request to determine the best response template.
 * Supports both Chinese and English input.
 * Returns a clarification requirement if vital info is missing (Proactive Behavior).
 */
export async function classifyRequest(brief) {
  // Proactive behavior: require roleTitle
  if (!brief || !brief.roleTitle || brief.roleTitle.trim() === '') {
    return {
      ok: false,
      needsClarification: true,
      message: "Proactive Agent Clarification: Please specify the 'roleTitle' you are targeting so I can provide relevant talent intelligence."
    };
  }

  const text = [brief?.hiringBrief, brief?.objective, brief?.rawInput, brief?.companyContext]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Proactive behavior: too little context
  if (text.length < 10) {
    return {
      ok: false,
      needsClarification: true,
      message: "Proactive Agent Clarification: The hiring brief is too vague. Could you provide more details about the objective or requirements?"
    };
  }

  // Check candidates field for assessment shortcut
  if (brief.candidates) {
    return {
      ok: true,
      templateId: 'candidate_assessment_cn',
      extractedContext: { roleTitle: brief.roleTitle }
    };
  }

  // Score each template by keyword hits
  let bestTemplate = 'jd_diagnosis_cn';
  let bestScore = 0;

  for (const [templateId, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = templateId;
    }
  }

  return {
    ok: true,
    templateId: bestTemplate,
    confidence: bestScore > 3 ? 'high' : bestScore > 1 ? 'medium' : 'low',
    extractedContext: {
      roleTitle: brief.roleTitle
    }
  };
}
