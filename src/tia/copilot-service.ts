// @ts-nocheck
function titleForTask(taskType) {
  return {
    bd_script: 'BD 开发话术',
    jd_diagnosis: '职位诊断',
    market_map: '市场测绘',
    interview_prep: '面试辅导',
    followup_plan: '推进跟进计划',
    invoice_email: '收款确认邮件',
    onboarding_plan: '入职回访方案',
    shortlist_summary: '长名单到短名单总结'
  }[taskType] || 'TIA Copilot';
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount ? `¥${Math.round(amount).toLocaleString('zh-CN')}` : 'TBD';
}

function buildFallbackContent(taskType, { positionContext, candidateProfile, notes }) {
  const positionTitle = positionContext?.position?.title || candidateProfile?.position_title || '目标职位';
  const clientName = positionContext?.client?.name || candidateProfile?.client_name || '目标客户';
  const candidateName = candidateProfile?.name || '候选人';
  const hardRequirements = JSON.stringify(positionContext?.clientPreferences?.hardRequirements || candidateProfile?.hard_requirements || {}, null, 2);
  const sources = (positionContext?.clientPreferences?.preferredSources || candidateProfile?.preferred_sources || []).join('、') || '行业头部平台与竞对团队';

  const templates = {
    bd_script: `# ${clientName} BD 开发话术\n\n## 冷启动开场\n您好，我这边最近在持续跟进 ${positionTitle} 相关的人才市场，看到贵司近期在这个方向上的组织动作比较明确，想约 15 分钟跟您交流一下市场供给、薪资带和可切入的人才来源。\n\n## 价值判断\n- 当前相关岗位市场竞争仍然偏激烈，顾问提前介入能显著缩短摸底时间。\n- 我们已经沉淀了一批来自 ${sources} 的可触达目标公司。\n- 如果本周能明确画像和流程节奏，可以把首批有效名单压缩到 5 个工作日内。\n\n## 费率建议\n建议优先用阶段性交付承诺换费率稳定；若是关键岗位或独家，可争取 20% 左右的标准费率。\n\n## 下一步\n- 先确认岗位是否存在预算或流程卡点。\n- 再给客户一版市场情况和可触达名单。${notes ? `\n\n## 备注\n${notes}` : ''}`,
    jd_diagnosis: `# ${positionTitle} 职位诊断\n\n## 交付难点\n- 当前画像要求与预算是否匹配，需要优先核实。\n- 硬性要求如下：\n\`\`\`json\n${hardRequirements}\n\`\`\`\n- 如果流程较长，候选人流失概率会明显上升。\n\n## 建议画像\n- 来自 ${sources} 的同类团队负责人或核心骨干。\n- 有相邻场景迁移能力的人选也应纳入短名单。\n\n## 市场动作\n- 先做 10-15 家目标公司 mapping。\n- 首周完成 6-8 个有效触达，验证预算和 title 吸引力。\n- 第二周根据反馈调整 rubric 和说法。`,
    market_map: `# ${positionTitle} 市场测绘\n\n## 优先公司池\n- ${sources}\n- 业务相似且人才密度高的竞对公司\n- 具备相邻能力的二线平台团队\n\n## 寻访策略\n- 第一批优先 contact 直接 owner 和带队经理。\n- 第二批补充同类平台上的高潜人才，避免只盯头部公司。\n- 对 off-limits 公司提前标注，避免顾问重复试错。\n\n## 输出建议\n- 每家公司至少给出 2 个标题关键词。\n- 每次触达都记录下一步动作和反馈标签。`,
    interview_prep: `# ${candidateName} 面试辅导\n\n## 候选人亮点\n- 当前公司：${candidateProfile?.current_company || 'TBD'}\n- 当前职位：${candidateProfile?.current_title || 'TBD'}\n- 目标职位：${positionTitle}\n\n## 面试重点\n- 用 2 个案例说明最强的业务结果和 owner 作用。\n- 针对客户硬性要求逐项准备证据。\n- 提前准备薪资预期和离职动机的稳定版本。\n\n## 建议追问\n- 你如何定义该岗位入职 90 天内的成功？\n- 这个团队目前最大的组织或业务约束是什么？`,
    followup_plan: `# ${candidateName} 推进计划\n\n## 当前状态\n- 当前阶段：${candidateProfile?.stage || 'TBD'}\n- 当前薪资：${formatCurrency(candidateProfile?.salary_current)}\n- 期望薪资：${formatCurrency(candidateProfile?.salary_expected)}\n\n## 48 小时动作\n- 先确认候选人热度和变动窗口。\n- 再同步客户的反馈时点、预算边界和流程推进人。\n- 如存在风险，补一条简短社交跟进消息维持热度。\n\n## 风险点\n- 若阶段超过阈值仍无动作，应立即升级处理。${notes ? `\n- 备注：${notes}` : ''}`,
    invoice_email: `# ${clientName} 收款确认邮件\n\n主题：关于 ${positionTitle} 交付与佣金结算确认\n\n您好，\n\n感谢贵司在 ${positionTitle} 项目中的配合。当前对应候选人流程已进入交付确认节点，我们建议按双方约定推进佣金结算与开票流程。\n\n如需，我可以同步候选人入职状态、保证期跟进安排以及后续支持计划，确保交付闭环。\n\n谢谢。\n`,
    onboarding_plan: `# ${candidateName} 入职回访方案\n\n## 回访目标\n- 确认候选人对岗位、团队和汇报关系的适应情况。\n- 识别潜在流失风险和管理预期差。\n- 同步客户 HR 当前表现与支持动作。\n\n## 建议提纲\n- 过去两周最顺畅和最不顺的事情分别是什么？\n- 角色 scope 是否与入职前预期一致？\n- 是否需要客户或顾问补充支持？`,
    shortlist_summary: `# ${positionTitle} 长名单到短名单总结\n\n## 当前判断\n- 短名单优先保留最接近硬性要求且热度高的候选人。\n- 长名单中保留可转化背景的人选，避免过早收口。\n\n## 输出建议\n- 用 3-4 个统一维度解释筛选逻辑。\n- 每位保留候选人都标注一个优势和一个风险。\n- 给客户明确下一步建议：先看谁、为什么、时间窗口是什么。`
  };

  const content = templates[taskType] || `# ${titleForTask(taskType)}\n\n暂无预设模板，请补充更明确的任务说明。`;
  return notes ? `${content}\n\n## 补充说明\n${notes}` : content;
}

export function createCopilotService({
  repository,
  llmClient,
  logger = console
}) {
  return {
    async runTask({
      taskType,
      positionId = undefined,
      candidateId = undefined,
      notes = ''
    } = {}) {
      const positionContext = positionId ? await repository.getPositionContext(positionId) : null;
      const candidateProfile = candidateId && typeof repository.getCandidateProfile === 'function'
        ? await repository.getCandidateProfile(candidateId)
        : null;

      const fallback = () => ({
        title: titleForTask(taskType),
        content: buildFallbackContent(taskType, { positionContext, candidateProfile, notes }),
        usedFallback: true
      });

      const system = '你是猎头顾问工作台的 AI Copilot。请基于给定上下文输出专业、简洁、可直接使用的 Markdown。';
      const user = [
        `任务类型：${taskType}`,
        `职位上下文：${JSON.stringify(positionContext || {}, null, 2)}`,
        `候选人上下文：${JSON.stringify(candidateProfile || {}, null, 2)}`,
        notes ? `补充说明：${notes}` : '补充说明：无',
        '请返回一个 Markdown 结果，要求包含结论、建议动作和可直接复用的话术或提纲。'
      ].join('\n\n');

      try {
        const content = await llmClient.completeText({
          system,
          user,
          fallback: () => fallback().content
        });

        return {
          taskType,
          title: titleForTask(taskType),
          content,
          usedFallback: !llmClient
        };
      } catch (error) {
        logger.warn?.(`[tia-copilot] fallback activated for ${taskType}: ${error.message}`);
        return {
          taskType,
          ...fallback()
        };
      }
    }
  };
}
