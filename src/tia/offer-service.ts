// @ts-nocheck
function fallbackOfferAnalysis(input = {}) {
  const expected = Number(input.salary_expected || 0);
  const budgetMax = Number(input.client_budget_max || 0);
  const competing = Boolean(input.has_competing_offer);
  const overBudget = expected && budgetMax && expected > budgetMax;

  return {
    riskLevel: competing || overBudget ? 'HIGH' : 'MED',
    clientScript: overBudget
      ? '候选人当前预期已超预算上限，若坚持推进，需要同步说明市场稀缺性并争取非现金补偿。'
      : '当前预算与候选人预期接近，建议尽快锁定流程和反馈时效，避免被其他机会截胡。',
    candidateScript: competing
      ? '我们理解你手上有其他机会，这边会尽快推动关键决策，同时把职位 scope 和长期空间讲清楚。'
      : '除薪资外，这个机会的 scope、汇报线和成长空间更关键，建议你综合比较而不是只看现金。 ',
    timeline: [
      '24 小时内同步客户真实预算与决策时点。',
      '48 小时内确认候选人底线与竞争机会进度。',
      '72 小时内决定是否发正式 offer 或调整方案。'
    ],
    counterOfferResponse: competing
      ? '优先确认竞争 offer 的真实阶段和决策时点，再决定是否拉齐报价或强化非现金价值。'
      : '当前无明确竞争 offer，可提前准备 counter-offer 预案但不必先暴露底牌。',
    recommendation: overBudget
      ? '若客户无法突破预算，建议尽快止损并调整目标画像。'
      : '建议继续推进，但必须缩短反馈链路。'
  };
}

export function createOfferService({ llmClient, logger = console }) {
  return {
    async analyzeOffer(input = {}) {
      const system = '你是猎头 offer 谈判分析助手。输出严格 JSON，不要输出 markdown。';
      const user = [
        '基于以下变量输出 riskLevel/clientScript/candidateScript/timeline/counterOfferResponse/recommendation：',
        JSON.stringify(input, null, 2)
      ].join('\n\n');

      const analysis = await llmClient.completeJson({
        system,
        user,
        fallback: () => fallbackOfferAnalysis(input)
      });

      logger.info?.('[tia-offer] generated offer analysis');
      return analysis;
    }
  };
}
