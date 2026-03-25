import { resolveTiaConfig } from './config.mjs';
import { publishLog } from './log-bus.mjs';
import { createPgExecutor } from './db-client.mjs';
import { createTiaRepository } from './repository.mjs';
import { createDemoRepository } from './demo-repository.mjs';
import { createLlmClient } from './llm-client.mjs';
import { createVectorizer } from './vectorizer.mjs';
import { createRiskService } from './risk-service.mjs';
import { createAssessmentService } from './assess-service.mjs';
import { createCcService } from './cc-service.mjs';
import { createReportService } from './report-service.mjs';
import { createOfferService } from './offer-service.mjs';
import { createWorkbenchService } from './workbench-service.mjs';
import { createCopilotService } from './copilot-service.mjs';
import { createBrowserService } from './browser-service.mjs';
import { createResumeImportService } from './resume-import-service.mjs';
import { classifyRequest } from '../../server/app/classifier.mjs';
import { getDomainKnowledge } from '../../server/app/rag.mjs';
import { validateWithExpertRules } from '../../server/app/expert-rules.mjs';

export function createTiaServiceContainer(overrides = {}) {
  const config = resolveTiaConfig(overrides.config || {});
  const logger = overrides.logger || console;
  let repositoryPromise;
  let pgExecutor;
  let llmClient;
  let vectorizer;
  let riskService;
  let assessmentService;
  let ccService;
  let reportService;
  let offerService;
  let workbenchService;
  let copilotService;
  let storageMode = overrides.repository ? 'custom-repository' : overrides.db ? 'custom-db' : config.pgUrl ? 'postgres' : 'demo-memory';

  async function getRepository() {
    if (!repositoryPromise) {
      repositoryPromise = (async () => {
        if (overrides.repository) {
          return overrides.repository;
        }

        if (overrides.db) {
          return createTiaRepository({
            db: overrides.db,
            defaultWebhookUrls: config.defaultWebhookUrls,
            logger
          });
        }

        if (config.pgUrl) {
          try {
            pgExecutor = await createPgExecutor({ pgUrl: config.pgUrl });
            storageMode = 'postgres';
            return createTiaRepository({
              db: pgExecutor,
              defaultWebhookUrls: config.defaultWebhookUrls,
              logger
            });
          } catch (error) {
            storageMode = 'demo-memory';
            logger.warn?.(`[tia] failed to initialize PostgreSQL repository, falling back to demo data: ${error.message}`);
          }
        }

        storageMode = 'demo-memory';
        return createDemoRepository({
          defaultWebhookUrls: config.defaultWebhookUrls,
          logger
        });
      })();
    }
    return repositoryPromise;
  }

  function getLlmClient() {
    if (!llmClient) {
      llmClient = overrides.llmClient || createLlmClient({
        baseUrl: config.llmBaseUrl,
        apiKey: config.llmApiKey,
        model: config.llmModel,
        logger
      });
    }
    return llmClient;
  }

  function getVectorizer() {
    if (!vectorizer) {
      vectorizer = overrides.vectorizer || createVectorizer({
        baseUrl: config.embeddingBaseUrl,
        apiKey: config.embeddingApiKey,
        model: config.embeddingModel,
        logger
      });
    }
    return vectorizer;
  }

  return {
    config,
    runtimeInfo() {
      return {
        storageMode,
        llmMode: config.llmBaseUrl ? 'remote-llm' : 'fallback-rules',
        embeddingMode: config.embeddingBaseUrl ? 'remote-embedding' : 'deterministic-fallback'
      };
    },
    async close() {
      if (pgExecutor && typeof pgExecutor.close === 'function') {
        await pgExecutor.close();
        logger.info?.('[tia] PostgreSQL connection pool closed.');
      }
    },
    async dbQuery(input) {
      publishLog({ type: 'tia.db_query', message: 'Executing db query', payload: { sql: input.sql } });
      const repository = await getRepository();
      return repository.dbQuery(input.sql, input.params || []);
    },
    async dbWrite(input) {
      publishLog({ type: 'tia.db_write', message: 'Executing db write', payload: { table: input.table, operation: input.operation } });
      const repository = await getRepository();
      return repository.dbWrite(input.table, input.operation, input.data || {});
    },
    async getPositionContext(input) {
      const repository = await getRepository();
      return repository.getPositionContext(input.position_id || input.positionId);
    },
    async stageUpdate(input) {
      publishLog({ type: 'tia.stage_update', message: 'Updating candidate stage', payload: input });
      const repository = await getRepository();
      return repository.stageUpdate(input.candidate_id || input.candidateId, input.new_stage || input.newStage, {
        summary: input.summary,
        nextAction: input.next_action || input.nextAction,
        webhookUrls: input.webhook_urls || input.webhookUrls
      });
    },
    async listPositions() {
      const repository = await getRepository();
      return repository.listPositions();
    },
    async listCandidates(positionId = undefined) {
      const repository = await getRepository();
      return repository.listCandidates(positionId);
    },
    async listClients() {
      const repository = await getRepository();
      return typeof repository.listClients === 'function' ? repository.listClients() : [];
    },
    async listTouchRecords(input = {}) {
      const repository = await getRepository();
      return typeof repository.listTouchRecords === 'function' ? repository.listTouchRecords(input) : [];
    },
    async getFunnel(positionId = undefined) {
      const repository = await getRepository();
      return repository.getFunnel(positionId);
    },
    async scanRisks(input = {}) {
      if (!riskService) {
        riskService = createRiskService({
          repository: await getRepository(),
          logger
        });
      }
      publishLog({ type: 'tia.risk_scan', message: 'Scanning workflow risks', payload: input });
      return riskService.scan({
        positionId: input.position_id || input.positionId
      });
    },
    async getWorkbench(input = {}) {
      if (!riskService) {
        riskService = createRiskService({
          repository: await getRepository(),
          logger
        });
      }
      if (!workbenchService) {
        workbenchService = createWorkbenchService({
          repository: await getRepository(),
          riskService,
          logger
        });
      }
      publishLog({ type: 'tia.workbench', message: 'Building workbench snapshot', payload: input });
      return workbenchService.getWorkbench({
        positionId: input.position_id || input.positionId
      });
    },
    async assessCandidate(input) {
      if (!assessmentService) {
        assessmentService = createAssessmentService({
          repository: await getRepository(),
          llmClient: getLlmClient(),
          vectorizer: getVectorizer(),
          logger
        });
      }
      publishLog({ type: 'tia.assess', message: 'Running candidate assessment', payload: input });
      return assessmentService.assessCandidate({
        positionId: input.position_id || input.positionId,
        candidateId: input.candidate_id || input.candidateId,
        candidateName: input.candidate_name || input.candidateName,
        resumeText: input.resume_text || input.resumeText,
        rubrics: input.rubrics
      });
    },
    async generateCc(input) {
      if (!ccService) {
        ccService = createCcService({
          repository: await getRepository(),
          llmClient: getLlmClient(),
          logger
        });
      }
      publishLog({ type: 'tia.cc', message: 'Generating outreach scripts', payload: input });
      return ccService.generateScripts({
        candidateId: input.candidate_id || input.candidateId,
        positionId: input.position_id || input.positionId,
        candidateBackground: input.candidate_background || input.candidateBackground,
        positionBrief: input.position_brief || input.positionBrief,
        stage: input.stage
      });
    },
    async generateReport(input) {
      if (!reportService) {
        reportService = createReportService({
          repository: await getRepository(),
          reportDir: config.reportDir,
          logger
        });
      }
      publishLog({ type: 'tia.report', message: 'Generating client report', payload: input });
      return reportService.generateReport({
        candidateId: input.candidate_id || input.candidateId
      });
    },
    async analyzeOffer(input) {
      if (!offerService) {
        offerService = createOfferService({
          llmClient: getLlmClient(),
          logger
        });
      }
      publishLog({ type: 'tia.offer', message: 'Analyzing offer strategy', payload: input });
      return offerService.analyzeOffer(input);
    },
    async runCopilot(input) {
      if (!copilotService) {
        copilotService = createCopilotService({
          repository: await getRepository(),
          llmClient: getLlmClient(),
          logger
        });
      }
      publishLog({ type: 'tia.copilot', message: 'Running copilot task', payload: input });
      return copilotService.runTask({
        taskType: input.task_type || input.taskType,
        positionId: input.position_id || input.positionId,
        candidateId: input.candidate_id || input.candidateId,
        notes: input.notes
      });
    },
    async classify(input) {
      publishLog({ type: 'tia.classify', message: 'Classifying request intent', payload: input });
      return classifyRequest(input);
    },
    async retrieveKnowledge(input) {
      publishLog({ type: 'tia.rag', message: 'Retrieving domain knowledge', payload: input });
      return getDomainKnowledge(input.roleTitle || input.role_title, input.industry);
    },
    async validateOutput(input) {
      publishLog({ type: 'tia.validate', message: 'Validating output with expert rules', payload: { templateId: input.templateId || input.template_id } });
      return validateWithExpertRules(input.markdown, input.templateId || input.template_id);
    },
    browserSearch(input) {
      publishLog({ type: 'tia.browser_search', message: 'Browser search on recruiting platform', payload: { platform: input.platform, keywords: input.keywords } });
      const browserService = createBrowserService({ logger });
      return browserService.search(input);
    },
    browserExtract(input) {
      publishLog({ type: 'tia.browser_extract', message: 'Extracting candidate data from page', payload: { platform: input.platform } });
      const browserService = createBrowserService({ logger });
      return browserService.extract(input);
    },
    async resumeImport(input) {
      publishLog({ type: 'tia.resume_import', message: 'Importing candidates to database', payload: { platform: input.platform, count: (input.candidates || []).length } });
      const importService = createResumeImportService({ logger });
      const normalized = importService.normalizeBatch(
        input.candidates || [],
        { platform: input.platform || 'unknown', positionId: input.positionId || input.position_id }
      );
      if (storageMode === 'demo-memory') {
        return { total: normalized.length, imported: normalized.length, skipped: 0, errors: 0, results: normalized.map(c => ({ name: c.name, status: 'imported', id: c.id })), note: 'Demo mode — candidates normalized but not persisted to real DB.' };
      }
      const repository = await getRepository();
      return importService.importToDb(normalized, repository);
    }
  };
}
