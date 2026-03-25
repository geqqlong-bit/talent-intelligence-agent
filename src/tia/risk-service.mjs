const STAGE_THRESHOLDS = {
  sourcing: 7,
  interview: 5,
  eval: 3,
  recommended: 5,
  client_interview: 14,
  offer: 3,
  placed: 30
};

function toDate(value) {
  return value ? new Date(value) : null;
}

function daysBetween(start, end = new Date()) {
  const startDate = toDate(start);
  if (!startDate) return 0;
  const ms = end.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function buildUrgency(daysStuck, threshold) {
  if (daysStuck >= threshold + 5) return 'HIGH';
  if (daysStuck > threshold) return 'MED';
  return 'LOW';
}

export function createRiskService({ repository, logger = console }) {
  return {
    async scan({ positionId = undefined, now = new Date() } = {}) {
      const candidates = await repository.listCandidates(positionId);
      const positions = positionId
        ? (await repository.listPositions()).filter((position) => position.id === positionId)
        : await repository.listPositions();
      const alerts = [];

      for (const candidate of candidates) {
        const threshold = STAGE_THRESHOLDS[candidate.stage] || 7;
        const daysStuck = daysBetween(candidate.stage_updated_at || candidate.updated_at, now);
        if (daysStuck > threshold) {
          alerts.push({
            type: 'candidate_stuck',
            urgency: buildUrgency(daysStuck, threshold),
            candidateId: candidate.id,
            candidateName: candidate.name,
            positionId: candidate.position_id,
            stage: candidate.stage,
            daysStuck,
            suggestedAction: `候选人在 ${candidate.stage} 阶段停留 ${daysStuck} 天，建议立即安排跟进并更新下一步。`
          });
        }

        if (candidate.offer_risk && candidate.offer_risk !== 'none') {
          alerts.push({
            type: 'offer_risk',
            urgency: candidate.offer_risk === 'competing_offer' ? 'HIGH' : 'MED',
            candidateId: candidate.id,
            candidateName: candidate.name,
            positionId: candidate.position_id,
            stage: candidate.stage,
            daysStuck,
            suggestedAction: `候选人存在 ${candidate.offer_risk} 风险，建议立即触发 tia-offer 分析并同步客户。`
          });
        }

        if (candidate.stage === 'placed' && candidate.onboard_date) {
          const checkinDays = daysBetween(candidate.onboard_date, now);
          if ([30, 60, 90].includes(checkinDays)) {
            alerts.push({
              type: 'onboarding_checkin',
              urgency: 'MED',
              candidateId: candidate.id,
              candidateName: candidate.name,
              positionId: candidate.position_id,
              stage: candidate.stage,
              daysStuck: checkinDays,
              suggestedAction: `候选人已入职 ${checkinDays} 天，建议发起 ${checkinDays} 天回访。`
            });
          }
        }
      }

      for (const position of positions) {
        const daysOpen = daysBetween(position.created_at, now);
        if (position.status === 'active' && daysOpen > 30) {
          alerts.push({
            type: 'position_open_too_long',
            urgency: daysOpen > 45 ? 'HIGH' : 'MED',
            positionId: position.id,
            positionTitle: position.title,
            daysStuck: daysOpen,
            suggestedAction: `职位 ${position.title} 已开放 ${daysOpen} 天，建议复盘 JD 和市场反馈。`
          });
        }

        if (position.contract_expires) {
          const daysUntilExpiry = Math.floor((new Date(position.contract_expires).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
            alerts.push({
              type: 'contract_expiring',
              urgency: daysUntilExpiry <= 3 ? 'HIGH' : 'MED',
              clientId: position.client_id,
              positionId: position.id,
              positionTitle: position.title,
              daysUntilExpiry,
              suggestedAction: `客户合同将在 ${daysUntilExpiry} 天内到期，建议准备续签邮件与拜访计划。`
            });
          }
        }
      }

      logger.info?.(`[tia-risk] generated ${alerts.length} alerts`);
      return {
        generatedAt: new Date().toISOString(),
        alerts
      };
    }
  };
}
