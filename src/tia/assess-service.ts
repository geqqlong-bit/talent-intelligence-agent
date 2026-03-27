// @ts-nocheck
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findEvidence(sentences, rubric) {
  const keywords = [rubric.label, rubric.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter((token) => token.length >= 2);

  const matches = sentences.filter((sentence) => keywords.some((token) => sentence.toLowerCase().includes(token)));
  return matches.slice(0, 2);
}

function buildFallbackAssessment({ resumeText, rubrics = [], candidateName = 'Candidate' }) {
  const sentences = splitSentences(resumeText);
  const dimensions = rubrics.map((rubric, index) => {
    const evidenceQuotes = findEvidence(sentences, rubric);
    const score = evidenceQuotes.length ? 78 + Math.min(15, evidenceQuotes.length * 6) : 58;
    return {
      key: rubric.id || `dimension_${index + 1}`,
      label: rubric.label || `维度 ${index + 1}`,
      score,
      confidence: evidenceQuotes.length ? '中' : '低',
      evidenceStatus: evidenceQuotes.length ? '证据充分' : '信息不足',
      evidenceQuotes,
      judgement: evidenceQuotes.length
        ? `${rubric.label} 相关证据已在简历中出现，可继续验证深度。`
        : `简历中缺少支撑 ${rubric.label} 的直接证据，需要面试补证。`,
      missingInformation: evidenceQuotes.length ? [] : [`需要补充与 ${rubric.label} 相关的具体经历与结果。`]
    };
  });

  const overallScore = dimensions.length
    ? Math.round(dimensions.reduce((sum, item) => sum + (item.score || 0), 0) / dimensions.length)
    : 65;

  return {
    candidateName,
    overallScore,
    score: overallScore,
    recommendation: overallScore >= 80 ? '建议推进' : overallScore >= 65 ? '谨慎推进' : '暂不推进',
    summary: `基于当前简历证据，对 ${candidateName} 的综合判断为 ${overallScore >= 80 ? '较强匹配' : overallScore >= 65 ? '存在机会但需补证' : '证据不足'}。`,
    dimensions,
    overallRisks: dimensions
      .filter((dimension) => dimension.evidenceStatus !== '证据充分')
      .map((dimension) => ({
        label: `${dimension.label} 证据不足`,
        detail: `${dimension.label} 缺少直接履历证据，建议在面试中先核实。`,
        confidence: '中',
        evidenceStatus: dimension.evidenceStatus,
        evidenceQuotes: dimension.evidenceQuotes
      })),
    followUpQuestions: rubrics.slice(0, 3).map((rubric) => `请举例说明你在 ${rubric.label} 方面最能代表自己的项目、职责与结果。`)
  };
}

function normalizeSimilarCases(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    stage: row.stage,
    currentCompany: row.current_company,
    currentTitle: row.current_title,
    similarity: row.similarity === null || row.similarity === undefined ? null : Number(Number(row.similarity).toFixed(4)),
    summary: row.ai_assessment?.summary || '',
    overallScore: row.ai_assessment?.overallScore ?? row.ai_assessment?.score ?? null
  }));
}

export function createAssessmentService({
  repository,
  llmClient,
  vectorizer,
  logger = console
}) {
  return {
    async assessCandidate({
      positionId,
      candidateId = undefined,
      candidateName = undefined,
      resumeText = '',
      rubrics = undefined
    }) {
      let resolvedResumeText = resumeText;
      let resolvedPositionId = positionId;
      let resolvedCandidateName = candidateName;

      if (candidateId) {
        const [candidate] = await repository.dbQuery('SELECT * FROM candidates WHERE id = $1', [candidateId]);
        if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);
        resolvedResumeText = resolvedResumeText || candidate.resume_text || candidate.notes || '';
        resolvedPositionId = resolvedPositionId || candidate.position_id;
        resolvedCandidateName = resolvedCandidateName || candidate.name;
      }

      const context = resolvedPositionId ? await repository.getPositionContext(resolvedPositionId) : null;
      const resolvedRubrics = safeArray(rubrics?.length ? rubrics : context?.position?.rubric).map((rubric, index) => ({
        id: rubric.id || `dimension_${index + 1}`,
        label: rubric.label || rubric.name || `维度 ${index + 1}`,
        description: rubric.description || rubric.focus || '',
        weight: rubric.weight || 1
      }));

      const fallback = () => buildFallbackAssessment({
        resumeText: resolvedResumeText,
        rubrics: resolvedRubrics,
        candidateName: resolvedCandidateName || 'Candidate'
      });

      const vector = await vectorizer.vectorizeText(resolvedResumeText || '');
      const similarCases = typeof repository.findSimilarSuccessfulCandidates === 'function'
        ? normalizeSimilarCases(await repository.findSimilarSuccessfulCandidates({
            positionId: resolvedPositionId,
            candidateId,
            vector,
            limit: 3
          }))
        : [];

      const system = '你是猎头候选人评估专家。返回严格 JSON，不要输出 markdown。必须引用简历原文证据。';
      const user = [
        `候选人姓名：${resolvedCandidateName || 'Unknown Candidate'}`,
        `职位：${context?.position?.title || 'Unknown Position'}`,
        `客户硬性要求：${JSON.stringify(context?.clientPreferences?.hardRequirements || {}, null, 2)}`,
        `历史拒绝模式：${JSON.stringify(context?.clientPreferences?.rejectionPatterns || [], null, 2)}`,
        `相似历史成功案例：${JSON.stringify(similarCases, null, 2)}`,
        `评估维度：${JSON.stringify(resolvedRubrics, null, 2)}`,
        '请返回 JSON：',
        '{"candidateName":"string","overallScore":0,"recommendation":"建议推进|谨慎推进|暂不推进","summary":"string","dimensions":[{"key":"string","label":"string","score":0,"confidence":"高|中|低","evidenceStatus":"证据充分|证据有限|信息不足","evidenceQuotes":["string"],"judgement":"string","missingInformation":["string"]}],"overallRisks":[{"label":"string","detail":"string","confidence":"高|中|低","evidenceStatus":"证据充分|证据有限|信息不足","evidenceQuotes":["string"]}],"followUpQuestions":["string"]}',
        '候选人简历：',
        resolvedResumeText || '信息不足'
      ].join('\n\n');

      const assessment = await llmClient.completeJson({ system, user, fallback });

      if (candidateId) {
        await repository.dbWrite('candidates', 'update', {
          id: candidateId,
          ai_assessment: assessment,
          embedding: vector
        });
      }

      logger.info?.(`[tia-assess] assessed ${resolvedCandidateName || candidateId || 'candidate'}`);
      return {
        ...assessment,
        similarCases,
        embeddingDimensions: vector.length
      };
    }
  };
}
