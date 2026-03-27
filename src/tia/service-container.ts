import { resolveTiaConfig } from './config.js';
import { publishLog } from './log-bus.js';
import { createPgExecutor } from './db-client.js';
import { createTiaRepository } from './repository.js';
import { createDemoRepository } from './demo-repository.js';
import { createLlmClient } from './llm-client.js';
import { createVectorizer } from './vectorizer.js';
import { createRiskService } from './risk-service.js';
import { createAssessmentService } from './assess-service.js';
import { createCcService } from './cc-service.js';
import { createReportService } from './report-service.js';
import { createOfferService } from './offer-service.js';
import { createWorkbenchService } from './workbench-service.js';
import { createCopilotService } from './copilot-service.js';
import { createBrowserService } from './browser-service.js';
import { createResumeImportService } from './resume-import-service.js';
import { classifyRequest } from '../../server/app/classifier.js';
import { getDomainKnowledge } from '../../server/app/rag.js';
import { validateWithExpertRules } from '../../server/app/expert-rules.js';
import type { TiaRepository } from './types.js';

export function createTiaServiceContainer(overrides: any = {}) {
  const config = resolveTiaConfig(overrides.config || {});
  const logger = overrides.logger || console;
  let repositoryPromise: Promise<TiaRepository>;
  let pgExecutor: any;
  let llmClient: any;
  let vectorizer: any;
  let riskService: any;
  let assessmentService: any;
  let ccService: any;
  let reportService: any;
  let offerService: any;
  let workbenchService: any;
  let copilotService: any;
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
          } catch (error: any) {
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
    async dbQuery(input: any) {
      publishLog({ type: 'tia.db_query', message: 'Executing db query', payload: { sql: input.sql } });
      const repository = await getRepository();
      return repository.dbQuery(input.sql, input.params || []);
    },
    async dbWrite(input: any) {
      publishLog({ type: 'tia.db_write', message: 'Executing db write', payload: { table: input.table, operation: input.operation } });
      const repository = await getRepository();
      return repository.dbWrite(input.table, input.operation, input.data || {});
    },
    async getPositionContext(input: any) {
      const repository = await getRepository();
      return repository.getPositionContext(input.position_id || input.positionId);
    },
    async stageUpdate(input: any) {
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
    async listCandidates(positionId?: string) {
      const repository = await getRepository();
      return repository.listCandidates(positionId);
    },
    async listClients() {
      const repository = await getRepository();
      return typeof repository.listClients === 'function' ? repository.listClients() : [];
    },
    async listTouchRecords(input: any = {}) {
      const repository = await getRepository();
      return typeof repository.listTouchRecords === 'function' ? repository.listTouchRecords(input) : [];
    },
    async getFunnel(positionId?: string) {
      const repository = await getRepository();
      return repository.getFunnel(positionId);
    },
    async scanRisks(input: any = {}) {
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
    async getWorkbench(input: any = {}) {
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
    async assessCandidate(input: any) {
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
    async generateCc(input: any) {
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
    async generateReport(input: any) {
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
    async analyzeOffer(input: any) {
      if (!offerService) {
        offerService = createOfferService({
          llmClient: getLlmClient(),
          logger
        });
      }
      publishLog({ type: 'tia.offer', message: 'Analyzing offer strategy', payload: input });
      return offerService.analyzeOffer(input);
    },
    async runCopilot(input: any) {
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
    async classify(input: any) {
      publishLog({ type: 'tia.classify', message: 'Classifying request intent', payload: input });
      return classifyRequest(input);
    },
    async retrieveKnowledge(input: any) {
      publishLog({ type: 'tia.rag', message: 'Retrieving domain knowledge', payload: input });
      return getDomainKnowledge(input.roleTitle || input.role_title, input.industry);
    },
    async validateOutput(input: any) {
      publishLog({ type: 'tia.validate', message: 'Validating output with expert rules', payload: { templateId: input.templateId || input.template_id } });
      return validateWithExpertRules(input.markdown, input.templateId || input.template_id);
    },
    browserSearch(input: any) {
      publishLog({ type: 'tia.browser_search', message: 'Browser search on recruiting platform', payload: { platform: input.platform, keywords: input.keywords } });
      const browserService = createBrowserService({ logger });
      return browserService.search(input);
    },
    browserExtract(input: any) {
      publishLog({ type: 'tia.browser_extract', message: 'Extracting candidate data from page', payload: { platform: input.platform } });
      const browserService = createBrowserService({ logger });
      return browserService.extract(input);
    },
    async resumeImport(input: any) {
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
