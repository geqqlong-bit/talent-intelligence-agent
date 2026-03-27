// @ts-nocheck
/**
 * Expert Rule validator (Critic layer)
 * Examines generated markdown against codified HR domain knowledge rules.
 * Returns pass/fail with detailed feedback for each violated rule.
 */

const RULES = {
  sourcing_strategy_cn: [
    {
      id: 'target_companies',
      check: (md) => md.includes('公司') || md.includes('Company') || md.toLowerCase().includes('target'),
      message: 'Sourcing strategy must contain an explicit list of Target Companies (目标公司).'
    },
    {
      id: 'channel_strategy',
      check: (md) => md.includes('渠道') || md.includes('channel') || md.includes('来源') || md.includes('source'),
      message: 'Sourcing strategy should specify sourcing channels or talent sources (寻访渠道/来源).'
    },
    {
      id: 'timeline',
      check: (md) => md.includes('周') || md.includes('天') || md.includes('week') || md.includes('day') || md.includes('timeline') || md.includes('阶段'),
      message: 'Sourcing strategy should include a timeline or phased execution plan (时间节点/阶段).'
    }
  ],

  candidate_assessment_cn: [
    {
      id: 'risk_section',
      check: (md) => md.includes('风险') || md.includes('Risk') || md.includes('concern') || md.includes('Concern'),
      message: 'Assessment must include a potential Risk or Concerns (风险评估) section to remain objective and professional.'
    },
    {
      id: 'evidence_based',
      check: (md) => md.includes('证据') || md.includes('evidence') || md.includes('简历') || md.includes('resume') || md.includes('经历'),
      message: 'Assessment should cite specific evidence from resume or experience (证据/经历), not just opinions.'
    },
    {
      id: 'recommendation',
      check: (md) => md.includes('建议') || md.includes('recommend') || md.includes('结论') || md.includes('conclusion'),
      message: 'Assessment should include a clear recommendation or conclusion (建议/结论).'
    }
  ],

  jd_diagnosis_cn: [
    {
      id: 'difficulty_analysis',
      check: (md) => md.includes('难') || md.includes('挑战') || md.includes('difficult') || md.includes('challenge') || md.includes('交付'),
      message: 'JD diagnosis should analyze hiring difficulty or delivery challenges (交付难点).'
    },
    {
      id: 'market_insight',
      check: (md) => md.includes('市场') || md.includes('market') || md.includes('薪资') || md.includes('salary') || md.includes('竞争'),
      message: 'JD diagnosis should include market or salary insights (市场洞察/薪资).'
    },
    {
      id: 'improvement_suggestion',
      check: (md) => md.includes('建议') || md.includes('优化') || md.includes('调整') || md.includes('suggest') || md.includes('improve'),
      message: 'JD diagnosis should suggest improvements or adjustments to the JD (JD优化建议).'
    }
  ],

  search_plan_cn: [
    {
      id: 'execution_steps',
      check: (md) => md.includes('步骤') || md.includes('阶段') || md.includes('step') || md.includes('phase') || md.includes('执行'),
      message: 'Search plan must include concrete execution steps or phases (执行步骤/阶段).'
    },
    {
      id: 'success_criteria',
      check: (md) => md.includes('指标') || md.includes('标准') || md.includes('criteria') || md.includes('metric') || md.includes('目标') || md.includes('KPI'),
      message: 'Search plan should define success criteria or KPIs (成功指标/KPI).'
    },
    {
      id: 'risk_mitigation',
      check: (md) => md.includes('风险') || md.includes('risk') || md.includes('预案') || md.includes('备选'),
      message: 'Search plan should address potential risks and mitigation strategies (风险与备选方案).'
    }
  ]
};

export async function validateWithExpertRules(markdown, templateId) {
  const templateRules = RULES[templateId];

  // If no rules defined for this template, pass by default
  if (!templateRules || !templateRules.length) {
    return { passed: true, templateId, rulesChecked: 0 };
  }

  const violations = [];
  const passed = [];

  for (const rule of templateRules) {
    if (rule.check(markdown)) {
      passed.push({ id: rule.id, status: 'passed' });
    } else {
      violations.push({ id: rule.id, message: `EXPERT RULE FAILED: ${rule.message}` });
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      templateId,
      rulesChecked: templateRules.length,
      rulesPassed: passed.length,
      rulesFailed: violations.length,
      violations,
      feedback: violations.map(v => v.message).join('\n')
    };
  }

  return {
    passed: true,
    templateId,
    rulesChecked: templateRules.length,
    rulesPassed: passed.length,
    rulesFailed: 0
  };
}
