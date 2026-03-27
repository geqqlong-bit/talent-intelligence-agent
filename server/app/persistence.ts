// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_RUNS_ROOT = path.resolve(process.cwd(), 'state', 'runs');

function toPathSafeSegment(value, fallback = 'unknown') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function daySegments(timestampIso) {
  const value = String(timestampIso || new Date().toISOString());
  return {
    year: value.slice(0, 4),
    month: value.slice(5, 7),
    day: value.slice(8, 10)
  };
}

function getRunsRoot() {
  return path.resolve(process.env.TALENT_INTEL_RUNS_DIR || DEFAULT_RUNS_ROOT);
}

function getRunDirectory(metadata = {}) {
  const { year, month, day } = daySegments(metadata.startedAt || metadata.timestamp);
  return path.join(getRunsRoot(), year, month, day, toPathSafeSegment(metadata.runId || metadata.requestId, 'run'));
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeLog(filePath, lines = []) {
  const content = [...lines.filter(Boolean), ''].join('\n');
  await fs.writeFile(filePath, content, 'utf8');
}

function buildEventLines(result) {
  const metadata = result?.metadata || {};
  const execution = result?.orchestration?.execution || {};
  const steps = Array.isArray(execution.steps) ? execution.steps : [];
  const lines = [
    `[${metadata.startedAt || metadata.timestamp || new Date().toISOString()}] run.received requestId=${metadata.requestId || 'unknown'} runId=${metadata.runId || 'n/a'} templateId=${result?.templateId || 'unknown'}`,
    `[${metadata.completedAt || metadata.timestamp || new Date().toISOString()}] run.${execution.status || result?.run?.status || 'completed'} runnerId=${metadata.runnerId || result?.run?.runnerId || 'unknown'} durationMs=${metadata.durationMs ?? 'n/a'}`
  ];

  for (const step of steps) {
    lines.push(
      `[${step.completedAt || step.startedAt || metadata.completedAt || new Date().toISOString()}] step.${step.status || 'completed'} id=${step.id || 'unknown'} kind=${step.kind || 'unknown'} durationMs=${step.durationMs ?? 'n/a'}`
    );
  }

  if (result?.artifacts?.files?.reportMarkdown) {
    lines.push(`[${metadata.completedAt || new Date().toISOString()}] artifact.report path=${result.artifacts.files.reportMarkdown}`);
  }

  return lines;
}

export async function persistRunArtifacts(result, requestPayload) {
  const metadata = result?.metadata || {};
  const runDir = getRunDirectory(metadata);
  const files = {
    request: path.join(runDir, 'request.json'),
    response: path.join(runDir, 'response.json'),
    reportMarkdown: path.join(runDir, 'report.md'),
    events: path.join(runDir, 'events.log')
  };

  await fs.mkdir(runDir, { recursive: true });

  const persistedResult = {
    ...result,
    artifacts: {
      rootDir: runDir,
      files: {
        request: files.request,
        response: files.response,
        reportMarkdown: files.reportMarkdown,
        events: files.events
      }
    }
  };

  await writeJson(files.request, requestPayload);
  await writeJson(files.response, persistedResult);
  await fs.writeFile(files.reportMarkdown, `${result?.reportMarkdown || ''}\n`, 'utf8');
  await writeLog(files.events, buildEventLines(persistedResult));

  return persistedResult;
}

export async function persistRunFailure(details = {}) {
  const timestamp = details.timestamp || new Date().toISOString();
  const runDir = getRunDirectory({
    timestamp,
    requestId: details.requestId,
    runId: details.runId || details.requestId || `failed-${Date.now()}`
  });

  const files = {
    request: path.join(runDir, 'request.json'),
    error: path.join(runDir, 'error.json'),
    events: path.join(runDir, 'events.log')
  };

  await fs.mkdir(runDir, { recursive: true });

  if (details.requestPayload !== undefined) {
    await writeJson(files.request, details.requestPayload);
  }

  await writeJson(files.error, {
    ok: false,
    requestId: details.requestId,
    runId: details.runId,
    error: details.error,
    metadata: {
      requestId: details.requestId,
      runId: details.runId,
      timestamp,
      rootDir: runDir
    }
  });

  await writeLog(files.events, [
    `[${timestamp}] run.failed requestId=${details.requestId || 'unknown'} runId=${details.runId || 'n/a'}`,
    `[${timestamp}] error.code=${details.error?.code || 'UNKNOWN'} message=${details.error?.message || 'Unknown error'}`
  ]);

  return {
    rootDir: runDir,
    files
  };
}
