// @ts-nocheck
function fallbackCcScripts({ candidateBackground, positionBrief, stage = 'sourcing' }) {
  const headline = String(candidateBackground?.currentCompany || candidateBackground?.title || '这次机会');
  return {
    opening: `你好，我最近在看一个和你当前经历很贴近的机会，尤其看重 ${headline} 这段背景，想用 15 秒和你确认一下你今年是否愿意听更高质量的机会。`,
    objectionHandlers: [
      '如果你现在不主动看机会也没关系，我先用一句话讲清楚岗位核心变化点，你判断是否值得继续听。',
      '如果你今天比较忙，我可以只发一段 80 字摘要给你，等你方便时再约 10 分钟。',
      '这个机会的亮点不是 title，而是 scope 和决策权，我先确认你是否对这类变化有兴趣。'
    ],
    closing: `明白，那我先把岗位摘要发你。如果你觉得 ${stage} 阶段信息还不够，我也可以在你方便的时候补 10 分钟背景。`,
    socialMessage: `看了你的背景，有个和你当前经历很贴近的岗位，重点是 scope 和业务 owner 空间。你若愿意，我发你 80 字摘要先看看。`,
    storageSummary: `已生成 ${stage} 阶段 CC 话术，覆盖开场、异议处理和跟进消息。`
  };
}

export function createCcService({ repository, llmClient, logger = console }) {
  return {
    async generateScripts({
      candidateId = undefined,
      positionId = undefined,
      candidateBackground = {},
      positionBrief = '',
      stage = 'sourcing'
    }) {
      let resolvedCandidate = null;
      if (candidateId) {
        const [candidate] = await repository.dbQuery('SELECT * FROM candidates WHERE id = $1', [candidateId]);
        resolvedCandidate = candidate || null;
      }

      const system = '你是资深猎头顾问。输出严格 JSON，字段为 opening、objectionHandlers、closing、socialMessage、storageSummary。';
      const user = [
        `候选人背景：${JSON.stringify(resolvedCandidate || candidateBackground, null, 2)}`,
        `职位摘要：${positionBrief}`,
        `当前阶段：${stage}`,
        '输出要求：自然、短句、不暴露客户名、微信消息 80 字以内。'
      ].join('\n\n');

      const scripts = await llmClient.completeJson({
        system,
        user,
        fallback: () => fallbackCcScripts({
          candidateBackground: resolvedCandidate || candidateBackground,
          positionBrief,
          stage
        })
      });

      if (candidateId) {
        await repository.dbWrite('touch_records', 'insert', {
          candidate_id: candidateId,
          position_id: positionId || resolvedCandidate?.position_id || null,
          touch_type: 'cc_call',
          summary: scripts.storageSummary || 'Generated CC scripts',
          sentiment: 'neutral',
          next_action: 'Use generated scripts for next outreach.'
        });
      }

      logger.info?.(`[tia-cc] generated scripts for ${candidateId || 'ad-hoc candidate'}`);
      return scripts;
    }
  };
}
