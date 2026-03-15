import { renderTemplate } from './templates.mjs';

export async function runTalentIntelligence(payload) {
  const startedAt = new Date().toISOString();
  const reportMarkdown = renderTemplate(payload);

  return {
    ok: true,
    mode: 'template-renderer',
    templateId: payload.templateId,
    engine: {
      kind: 'local-template-engine',
      version: 'v0.1'
    },
    summary: {
      projectName: payload.searchContext.projectName,
      roleTitle: payload.searchContext.roleTitle,
      templateId: payload.templateId
    },
    reportMarkdown,
    metadata: {
      startedAt,
      completedAt: new Date().toISOString()
    }
  };
}
