import fs from 'fs/promises';
import path from 'path';

function list(items = []) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- TBD';
}

function normalizeAssessment(assessment = {}) {
  return assessment && typeof assessment === 'object' ? assessment : {};
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHtmlReport({ row, assessment, dimensions, overallRisks, followUpQuestions }) {
  const dimensionHtml = dimensions.length
    ? dimensions.map((dimension) => {
        const evidence = Array.isArray(dimension.evidenceQuotes) && dimension.evidenceQuotes.length
          ? dimension.evidenceQuotes.map((quote) => `<li>${escapeHtml(quote)}</li>`).join('')
          : '<li>证据待补充</li>';
        return `
          <section class="card">
            <h3>${escapeHtml(dimension.label)}</h3>
            <p><strong>判断：</strong>${escapeHtml(dimension.judgement || 'TBD')}</p>
            <p><strong>置信度：</strong>${escapeHtml(dimension.confidence || '中')}</p>
            <ul>${evidence}</ul>
          </section>
        `;
      }).join('')
    : '<section class="card"><p>需先运行 tia-assess 生成结构化评估。</p></section>';

  const risksHtml = overallRisks.length
    ? overallRisks.map((risk) => `<li>${escapeHtml(risk.label)}：${escapeHtml(risk.detail)}</li>`).join('')
    : '<li>暂无结构化风险，建议结合面试补证。</li>';

  const followUpHtml = followUpQuestions.length
    ? followUpQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')
    : '<li>TBD</li>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>推荐报告｜${escapeHtml(row.name)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe8;
      --card: rgba(255, 255, 255, 0.9);
      --ink: #1d2433;
      --muted: #5e6678;
      --accent: #0e5b63;
      --line: rgba(29, 36, 51, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Georgia", "Songti SC", serif;
      background:
        radial-gradient(circle at top left, rgba(14, 91, 99, 0.14), transparent 28%),
        linear-gradient(135deg, #f7f3ec, #ede4da);
      color: var(--ink);
    }
    main { max-width: 960px; margin: 0 auto; padding: 40px 24px 64px; }
    header { padding: 28px; border: 1px solid var(--line); background: var(--card); border-radius: 24px; backdrop-filter: blur(12px); }
    h1, h2, h3 { margin: 0 0 12px; }
    h1 { font-size: 34px; }
    h2 { font-size: 22px; margin-top: 28px; }
    h3 { font-size: 18px; }
    p, li { line-height: 1.65; color: var(--muted); }
    ul { margin: 0; padding-left: 20px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
    .meta div, .card {
      padding: 18px;
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 18px;
      backdrop-filter: blur(12px);
    }
    .section-grid { display: grid; gap: 16px; margin-top: 16px; }
    strong { color: var(--ink); }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>推荐报告｜${escapeHtml(row.name)}</h1>
      <p>${escapeHtml(assessment.summary || '建议先核实候选人关键 ownership、薪资与动机，再安排客户面试。')}</p>
      <div class="meta">
        <div><strong>推荐职位</strong><br>${escapeHtml(row.position_title || 'TBD')}</div>
        <div><strong>客户</strong><br>${escapeHtml(row.client_name || 'TBD')}</div>
        <div><strong>综合建议</strong><br>${escapeHtml(assessment.recommendation || '谨慎推进')}</div>
        <div><strong>综合评分</strong><br>${escapeHtml(assessment.overallScore ?? assessment.score ?? 'TBD')}</div>
      </div>
    </header>

    <section>
      <h2>核心优势</h2>
      <div class="section-grid">${dimensionHtml}</div>
    </section>

    <section>
      <h2>风险点</h2>
      <div class="card"><ul>${risksHtml}</ul></div>
    </section>

    <section>
      <h2>匹配度分析</h2>
      <div class="card">
        <p><strong>客户硬性要求：</strong>${escapeHtml(JSON.stringify(row.hard_requirements || {}, null, 2))}</p>
        <p><strong>薪资上限：</strong>${escapeHtml(row.salary_ceiling || 'TBD')}</p>
        <p><strong>当前期望：</strong>${escapeHtml(row.salary_expected || 'TBD')}</p>
      </div>
    </section>

    <section>
      <h2>建议面试方向</h2>
      <div class="card"><ul>${followUpHtml}</ul></div>
    </section>
  </main>
</body>
</html>`;
}

export function createReportService({
  repository,
  reportDir,
  logger = console
}) {
  return {
    async generateReport({ candidateId }) {
      const rows = await repository.dbQuery(
        `SELECT
           cd.*,
           p.title AS position_title,
           p.jd_raw,
           p.rubric,
           c.name AS client_name,
           cp.hard_requirements,
           cp.salary_ceiling
         FROM candidates cd
         JOIN positions p ON p.id = cd.position_id
         JOIN clients c ON c.id = p.client_id
         LEFT JOIN client_preferences cp ON cp.client_id = c.id
         WHERE cd.id = $1`,
        [candidateId]
      );

      const row = rows[0];
      if (!row) throw new Error(`Candidate not found: ${candidateId}`);

      const assessment = normalizeAssessment(row.ai_assessment);
      const dimensions = Array.isArray(assessment.dimensions) ? assessment.dimensions : [];
      const overallRisks = Array.isArray(assessment.overallRisks) ? assessment.overallRisks : [];
      const followUpQuestions = Array.isArray(assessment.followUpQuestions) ? assessment.followUpQuestions : [];

      const markdown = [
        `# 推荐报告｜${row.name}`,
        '',
        '## 候选人摘要',
        '',
        `- 候选人：${row.name}`,
        `- 当前公司：${row.current_company || 'TBD'}`,
        `- 当前职位：${row.current_title || 'TBD'}`,
        `- 推荐职位：${row.position_title}`,
        `- 客户：${row.client_name}`,
        `- 综合建议：${assessment.recommendation || '谨慎推进'}`,
        `- 综合评分：${assessment.overallScore ?? assessment.score ?? 'TBD'}`,
        '',
        '## 核心优势',
        '',
        dimensions.length
          ? dimensions.map((dimension) => {
              const evidence = Array.isArray(dimension.evidenceQuotes) && dimension.evidenceQuotes.length
                ? dimension.evidenceQuotes.map((quote) => `  - "${quote}"`).join('\n')
                : '  - 证据待补充';
              return `### ${dimension.label}\n- 判断：${dimension.judgement || 'TBD'}\n- 置信度：${dimension.confidence || '中'}\n- 证据：\n${evidence}`;
            }).join('\n\n')
          : '- 需先运行 tia-assess 生成结构化评估。',
        '',
        '## 风险点',
        '',
        overallRisks.length
          ? overallRisks.map((risk) => `- ${risk.label}：${risk.detail}`).join('\n')
          : '- 暂无结构化风险，建议结合面试补证。',
        '',
        '## 匹配度分析',
        '',
        `- 客户硬性要求：${JSON.stringify(row.hard_requirements || {}, null, 2)}`,
        `- 薪资上限：${row.salary_ceiling || 'TBD'}`,
        `- 当前期望：${row.salary_expected || 'TBD'}`,
        '',
        '## 建议面试方向',
        '',
        list(followUpQuestions),
        '',
        '## 顾问推荐意见',
        '',
        assessment.summary || '建议先核实候选人关键 ownership、薪资与动机，再安排客户面试。'
      ].join('\n');

      await fs.mkdir(reportDir, { recursive: true });
      const outputPath = path.join(reportDir, `candidate-report-${candidateId}.md`);
      const htmlPath = path.join(reportDir, `candidate-report-${candidateId}.html`);
      const html = buildHtmlReport({ row, assessment, dimensions, overallRisks, followUpQuestions });
      await fs.writeFile(outputPath, `${markdown}\n`, 'utf8');
      await fs.writeFile(htmlPath, html, 'utf8');

      logger.info?.(`[tia-report] wrote ${outputPath}`);
      return {
        candidateId,
        reportMarkdown: markdown,
        outputPath,
        htmlPath
      };
    }
  };
}
