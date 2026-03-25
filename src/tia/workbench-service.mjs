const STAGE_ORDER = ['sourcing', 'interview', 'eval', 'recommended', 'client_interview', 'offer', 'placed'];
const STAGE_LABELS = {
  sourcing: '寻访/CC',
  interview: '深度面谈',
  eval: '内部评估',
  recommended: '已推荐',
  client_interview: '客户面试',
  offer: 'Offer谈判',
  placed: '已成单'
};

const TIER_META = {
  star: { label: '明星', tone: 'amber' },
  cashcow: { label: '金牛', tone: 'teal' },
  growth: { label: '潜力', tone: 'blue' },
  watch: { label: '观察', tone: 'gray' }
};

function toDate(value) {
  return value ? new Date(value) : null;
}

function daysBetween(start, end = new Date()) {
  const startDate = toDate(start);
  if (!startDate) return 0;
  return Math.max(0, Math.floor((end.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function sum(values = []) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function average(values = []) {
  if (!values.length) return 0;
  return Math.round(sum(values) / values.length);
}

function urgencyRank(value) {
  if (value === 'HIGH') return 3;
  if (value === 'MED') return 2;
  return 1;
}

function offerRiskUrgency(offerRisk) {
  if (offerRisk === 'competing_offer') return 'HIGH';
  if (offerRisk === 'counter_offer') return 'MED';
  return 'LOW';
}

function stageRank(stage) {
  const index = STAGE_ORDER.indexOf(stage);
  return index === -1 ? 0 : index + 1;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectPositionId(positionId, positions) {
  if (positionId && positions.some((position) => position.id === positionId)) {
    return positionId;
  }
  return positions.find((position) => position.status === 'active')?.id || positions[0]?.id || null;
}

function classifyClient(client, clientPositions, clientAlerts) {
  const activePositionCount = clientPositions.filter((position) => position.status === 'active').length;
  const pipelineFee = sum(clientPositions.map((position) => position.target_fee));
  const highRiskCount = clientAlerts.filter((alert) => alert.urgency === 'HIGH').length;
  const contractDays = client.contract_expires ? Math.max(0, Math.floor((new Date(client.contract_expires).getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;

  let tier = 'watch';
  if (pipelineFee >= 150000 || activePositionCount >= 2) tier = 'star';
  else if (contractDays !== null && contractDays <= 14) tier = 'cashcow';
  else if (activePositionCount === 1) tier = 'growth';

  return {
    id: client.id,
    name: client.name,
    industry: client.industry,
    tier,
    tierLabel: TIER_META[tier].label,
    tierTone: TIER_META[tier].tone,
    activePositionCount,
    pipelineFee,
    contractDays,
    highRiskCount,
    summary: contractDays !== null && contractDays <= 14
      ? `合同 ${contractDays} 天内到期，建议优先做续签与增购。`
      : activePositionCount
        ? `当前有 ${activePositionCount} 个活跃职位，适合做深耕与扩单。`
        : '暂无活跃职位，适合唤醒或重新探需。'
  };
}

function buildPriorityItems(alerts, touchRecords) {
  const alertTasks = alerts.map((alert, index) => ({
    id: `alert-${index}`,
    title: alert.candidateName
      ? `${alert.candidateName} · ${alert.type}`
      : `${alert.positionTitle || alert.positionId} · ${alert.type}`,
    summary: alert.suggestedAction,
    urgency: alert.urgency,
    type: 'risk'
  }));

  const touchTasks = touchRecords
    .filter((record) => record.next_action)
    .map((record) => ({
      id: `touch-${record.id}`,
      title: `${record.candidate_name || '候选人'} · ${record.touch_type}`,
      summary: record.next_action,
      urgency: record.sentiment === 'negative' ? 'HIGH' : 'MED',
      type: 'followup'
    }));

  return [...alertTasks, ...touchTasks]
    .sort((left, right) => urgencyRank(right.urgency) - urgencyRank(left.urgency))
    .slice(0, 7);
}

function buildPositionCards(positions, candidates, alerts) {
  return positions.map((position) => {
    const scopedCandidates = candidates.filter((candidate) => candidate.position_id === position.id);
    const recommendedCount = scopedCandidates.filter((candidate) => stageRank(candidate.stage) >= stageRank('recommended')).length;
    const placedCount = scopedCandidates.filter((candidate) => candidate.stage === 'placed').length;
    const positionAlerts = alerts.filter((alert) => alert.positionId === position.id);
    const daysOpen = daysBetween(position.created_at);
    const progressBase = scopedCandidates.length || 1;

    return {
      id: position.id,
      title: position.title,
      clientName: position.client_name,
      status: position.status,
      targetFee: Number(position.target_fee || 0),
      daysOpen,
      recommendedCount,
      placedCount,
      candidateCount: scopedCandidates.length,
      progressRatio: Math.min(1, (recommendedCount + (placedCount * 2)) / (progressBase + 1)),
      riskLevel: positionAlerts.some((alert) => alert.urgency === 'HIGH') ? 'HIGH' : positionAlerts.some((alert) => alert.urgency === 'MED') ? 'MED' : 'LOW'
    };
  }).sort((left, right) => right.daysOpen - left.daysOpen);
}

function buildKanbanColumns(candidates) {
  return STAGE_ORDER.map((stage) => {
    const stageCandidates = candidates
      .filter((candidate) => candidate.stage === stage)
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')))
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        title: candidate.current_title,
        company: candidate.current_company,
        score: candidate.ai_assessment?.overallScore ?? candidate.ai_assessment?.score ?? null,
        offerRisk: candidate.offer_risk,
        updatedAt: candidate.updated_at
      }));

    return {
      id: stage,
      label: STAGE_LABELS[stage],
      count: stageCandidates.length,
      candidates: stageCandidates
    };
  });
}

function buildRevenueSummary(positions, candidates) {
  const confirmedPositionIds = new Set(candidates.filter((candidate) => candidate.stage === 'placed').map((candidate) => candidate.position_id));
  const probablePositionIds = new Set(candidates.filter((candidate) => ['offer', 'client_interview'].includes(candidate.stage)).map((candidate) => candidate.position_id));

  return {
    confirmed: sum(positions.filter((position) => confirmedPositionIds.has(position.id)).map((position) => position.target_fee)),
    probable: sum(positions.filter((position) => probablePositionIds.has(position.id)).map((position) => position.target_fee)),
    averageCycleDays: average(
      candidates
        .filter((candidate) => candidate.stage === 'placed' && candidate.onboard_date)
        .map((candidate) => daysBetween(candidate.created_at, new Date(candidate.onboard_date)))
    )
  };
}

function buildAiWorkbenchActions() {
  return [
    { id: 'bd_script', title: '生成 BD 话术', description: '面向客户开发、续签和冷启动。', tone: 'amber' },
    { id: 'jd_diagnosis', title: '职位诊断', description: '输出难点、薪资带和市场建议。', tone: 'blue' },
    { id: 'market_map', title: '市场测绘', description: '给出目标公司池与寻源路径。', tone: 'purple' },
    { id: 'interview_prep', title: '面试辅导', description: '给候选人和顾问准备面试脚本。', tone: 'teal' },
    { id: 'followup_plan', title: '推进跟进计划', description: '围绕当前阶段生成下一步动作。', tone: 'coral' },
    { id: 'invoice_email', title: '收款与交付邮件', description: '用于 offer、入职和佣金确认。', tone: 'green' }
  ];
}

export function createWorkbenchService({
  repository,
  riskService,
  logger = console
}) {
  return {
    async getWorkbench({ positionId = undefined } = {}) {
      const [positions, candidates, clients, alertsSnapshot, touchRecords] = await Promise.all([
        repository.listPositions(),
        repository.listCandidates(),
        typeof repository.listClients === 'function' ? repository.listClients() : [],
        riskService.scan({}),
        typeof repository.listTouchRecords === 'function' ? repository.listTouchRecords({ limit: 24 }) : []
      ]);

      const alerts = alertsSnapshot.alerts || [];
      const selectedPositionId = selectPositionId(positionId, positions);
      const selectedPosition = positions.find((position) => position.id === selectedPositionId) || null;
      const selectedContext = selectedPositionId ? await repository.getPositionContext(selectedPositionId) : null;
      const selectedCandidates = selectedPositionId
        ? candidates.filter((candidate) => candidate.position_id === selectedPositionId)
        : candidates;

      const revenue = buildRevenueSummary(positions, candidates);
      const positionCards = buildPositionCards(positions, candidates, alerts);
      const bdClients = clients.map((client) => classifyClient(
        client,
        positions.filter((position) => position.client_id === client.id),
        alerts.filter((alert) => alert.clientId === client.id || positions.some((position) => position.id === alert.positionId && position.client_id === client.id))
      ));

      const bdOpportunities = uniqueBy([
        ...alerts
          .filter((alert) => alert.type === 'contract_expiring')
          .map((alert) => ({
            id: `renew-${alert.positionId}`,
            title: `${alert.positionTitle || alert.positionId} · 合同续签`,
            summary: alert.suggestedAction,
            tone: 'purple'
          })),
        ...positionCards
          .filter((position) => position.riskLevel !== 'LOW')
          .map((position) => ({
            id: `position-${position.id}`,
            title: `${position.clientName} · ${position.title}`,
            summary: `${position.daysOpen} 天在跑，当前已推荐 ${position.recommendedCount} 人。`,
            tone: position.riskLevel === 'HIGH' ? 'coral' : 'amber'
          }))
      ], (item) => item.id).slice(0, 6);

      const followUps = candidates
        .filter((candidate) => candidate.stage === 'placed')
        .map((candidate) => ({
          id: candidate.id,
          candidateName: candidate.name,
          positionId: candidate.position_id,
          daysSinceOnboard: candidate.onboard_date ? daysBetween(candidate.onboard_date) : null,
          status: candidate.onboard_date && [30, 60, 90].includes(daysBetween(candidate.onboard_date)) ? '需要回访' : '跟踪中'
        }))
        .sort((left, right) => Number(right.daysSinceOnboard || 0) - Number(left.daysSinceOnboard || 0));

      const negotiations = candidates
        .filter((candidate) => candidate.stage === 'offer' || candidate.offer_risk !== 'none')
        .sort((left, right) => urgencyRank(offerRiskUrgency(right.offer_risk)) - urgencyRank(offerRiskUrgency(left.offer_risk)))
        .map((candidate) => ({
          id: candidate.id,
          candidateName: candidate.name,
          positionId: candidate.position_id,
          currentCompany: candidate.current_company,
          stage: candidate.stage,
          salaryCurrent: candidate.salary_current,
          salaryExpected: candidate.salary_expected,
          offerRisk: candidate.offer_risk
        }));

      const overviewMetrics = {
        confirmedFee: revenue.confirmed,
        activePositions: positions.filter((position) => position.status === 'active').length,
        pipelineCandidates: candidates.filter((candidate) => candidate.stage !== 'placed').length,
        averageCycleDays: revenue.averageCycleDays
      };

      logger.info?.('[tia-workbench] generated workbench snapshot');
      return {
        generatedAt: new Date().toISOString(),
        selectedPositionId,
        dashboard: {
          metrics: overviewMetrics,
          priorities: buildPriorityItems(alerts, touchRecords),
          funnel: STAGE_ORDER.map((stage) => {
            const count = candidates.filter((candidate) => candidate.stage === stage).length;
            return {
              stage,
              label: STAGE_LABELS[stage],
              count
            };
          }),
          alerts: alerts.slice(0, 6)
        },
        bd: {
          metrics: {
            leadPool: clients.length,
            contractsNegotiating: bdClients.filter((client) => client.contractDays !== null && client.contractDays <= 30).length,
            newSigned: positions.filter((position) => daysBetween(position.created_at) <= 30).length,
            renewalRate: clients.length ? Math.round((bdClients.filter((client) => client.contractDays === null || client.contractDays > 0).length / clients.length) * 100) : 0
          },
          clients: bdClients,
          opportunities: bdOpportunities
        },
        positions: {
          items: positionCards,
          selectedContext
        },
        kanban: {
          positionId: selectedPositionId,
          positionTitle: selectedPosition?.title || null,
          clientName: selectedContext?.client?.name || selectedPosition?.client_name || null,
          candidateCount: selectedCandidates.length,
          columns: buildKanbanColumns(selectedCandidates)
        },
        offer: {
          negotiations,
          followUps,
          revenue
        },
        aiWorkbench: {
          actions: buildAiWorkbenchActions()
        }
      };
    }
  };
}
