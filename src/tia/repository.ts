import { emitWebhookEvents } from './webhooks.js';
import type { TiaDbExecutor, TiaRepository, Position, Candidate, Client, ClientPreferences, TouchRecord, RepositoryOptions } from './types.js';

const CORE_TABLES = new Set([
  'positions',
  'candidates',
  'clients',
  'client_preferences',
  'touch_records'
]);

const STAGES = new Set([
  'sourcing',
  'interview',
  'eval',
  'recommended',
  'client_interview',
  'offer',
  'placed'
]);

function safeIdentifier(value: string): string {
  const identifier = String(value || '').trim();
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return identifier;
}

function normalizeDbValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
  return value;
}

function toVectorLiteral(vector: number[] = []): string | null {
  if (!Array.isArray(vector) || !vector.length) return null;
  return `[${vector.map((value) => Number(value || 0)).join(',')}]`;
}

function buildInsertStatement(table: string, data: Record<string, unknown> = {}): { text: string; values: unknown[] } {
  const fields = Object.keys(data);
  if (!fields.length) {
    throw new Error(`Insert on ${table} requires at least one field.`);
  }
  const columns = fields.map((field) => safeIdentifier(field));
  const values = fields.map((field) => normalizeDbValue(data[field]));
  const placeholders = fields.map((_, index) => `$${index + 1}`);
  return {
    text: `INSERT INTO ${safeIdentifier(table)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  };
}

function buildUpdateStatement(table: string, id: string, data: Record<string, unknown> = {}): { text: string; values: unknown[] } {
  const fields = Object.keys(data).filter((field) => field !== 'id');
  if (!fields.length) {
    throw new Error(`Update on ${table} requires fields other than id.`);
  }
  const assignments = fields.map((field, index) => `${safeIdentifier(field)} = $${index + 1}`);
  const values = fields.map((field) => normalizeDbValue(data[field]));
  values.push(id);
  return {
    text: `UPDATE ${safeIdentifier(table)} SET ${assignments.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`,
    values
  };
}

export function createTiaRepository({
  db,
  defaultWebhookUrls = [],
  logger = console
}: RepositoryOptions): TiaRepository {
  if (!db?.query) {
    throw new Error('TIA repository requires a db executor with query(text, params).');
  }

  return {
    async dbQuery(sql, params = []) {
      const result = await db.query(sql, params);
      return result.rows || [];
    },

    async dbWrite(table, operation, data = {}) {
      if (!CORE_TABLES.has(table)) {
        throw new Error(`Unsupported table: ${table}`);
      }

      const timestamp = new Date().toISOString();

      if (operation === 'insert') {
        const insertData = {
          ...data,
          created_at: data.created_at || timestamp,
          updated_at: data.updated_at || timestamp
        };
        const statement = buildInsertStatement(table, insertData);
        const result = await db.query(statement.text, statement.values);
        return result.rows?.[0] || null;
      }

      if (operation === 'update') {
        if (!data.id) throw new Error(`Update on ${table} requires data.id.`);
        const statement = buildUpdateStatement(table, data.id, {
          ...data,
          updated_at: data.updated_at || timestamp
        });
        const result = await db.query(statement.text, statement.values);
        return result.rows?.[0] || null;
      }

      if (operation === 'delete') {
        if (!data.id) throw new Error(`Delete on ${table} requires data.id.`);
        const result = await db.query(`DELETE FROM ${safeIdentifier(table)} WHERE id = $1 RETURNING *`, [data.id]);
        return result.rows?.[0] || null;
      }

      throw new Error(`Unsupported operation: ${operation}`);
    },

    async getPositionContext(positionId) {
      const [positionRow] = await this.dbQuery(
        `SELECT
           p.*,
           c.name AS client_name,
           c.industry AS client_industry,
           c.contract_expires,
           cp.hard_requirements,
           cp.rejection_patterns,
           cp.off_limits,
           cp.preferred_sources,
           cp.salary_ceiling
         FROM positions p
         JOIN clients c ON c.id = p.client_id
         LEFT JOIN client_preferences cp ON cp.client_id = c.id
         WHERE p.id = $1`,
        [positionId]
      );

      if (!positionRow) {
        throw new Error(`Position not found: ${positionId}`);
      }

      const rejectionRows = await this.dbQuery(
        `SELECT tr.summary, tr.created_at, cd.name AS candidate_name
         FROM touch_records tr
         JOIN candidates cd ON cd.id = tr.candidate_id
         WHERE cd.position_id = $1 AND tr.touch_type = 'client_feedback'
         ORDER BY tr.created_at DESC
         LIMIT 5`,
        [positionId]
      );

      const funnelRows = await this.dbQuery(
        `SELECT stage, COUNT(*)::int AS candidate_count
         FROM candidates
         WHERE position_id = $1
         GROUP BY stage
         ORDER BY stage`,
        [positionId]
      );

      return {
        position: {
          id: positionRow.id,
          title: positionRow.title,
          status: positionRow.status,
          jdRaw: positionRow.jd_raw,
          jdDiagnosis: positionRow.jd_diagnosis,
          rubric: positionRow.rubric,
          targetFee: positionRow.target_fee,
          createdAt: positionRow.created_at
        },
        client: {
          id: positionRow.client_id,
          name: positionRow.client_name,
          industry: positionRow.client_industry,
          contractExpires: positionRow.contract_expires
        },
        clientPreferences: {
          hardRequirements: positionRow.hard_requirements || {},
          rejectionPatterns: positionRow.rejection_patterns || [],
          offLimits: positionRow.off_limits || [],
          preferredSources: positionRow.preferred_sources || [],
          salaryCeiling: positionRow.salary_ceiling
        },
        recentRejections: rejectionRows.map((row) => ({
          candidateName: row.candidate_name,
          summary: row.summary,
          createdAt: row.created_at
        })),
        funnel: funnelRows.map((row) => ({
          stage: row.stage,
          candidateCount: row.candidate_count
        }))
      };
    },

    async stageUpdate(candidateId, newStage, options = {}) {
      if (!STAGES.has(newStage)) {
        throw new Error(`Unsupported candidate stage: ${newStage}`);
      }

      const [candidate] = await this.dbQuery('SELECT * FROM candidates WHERE id = $1', [candidateId]);
      if (!candidate) {
        throw new Error(`Candidate not found: ${candidateId}`);
      }

      const timestamp = new Date().toISOString();
      const updateFields: Record<string, any> = {
        id: candidateId,
        stage: newStage,
        stage_updated_at: timestamp,
        updated_at: timestamp
      };
      if (newStage === 'placed') {
        updateFields.onboard_date = options.onboardDate || timestamp.slice(0, 10);
      }

      const updatedCandidate = await this.dbWrite('candidates', 'update', updateFields);
      const touchRecord = await this.dbWrite('touch_records', 'insert', {
        candidate_id: candidateId,
        position_id: candidate.position_id,
        touch_type: 'stage_change',
        summary: options.summary || `Candidate moved to ${newStage}`,
        sentiment: 'neutral',
        next_action: options.nextAction || null
      });

      const webhookResults = await emitWebhookEvents(
        options.webhookUrls || defaultWebhookUrls,
        {
          type: 'candidate.stage_changed',
          candidateId,
          positionId: candidate.position_id,
          previousStage: candidate.stage,
          newStage,
          occurredAt: timestamp
        },
        logger
      );

      return {
        candidate: updatedCandidate,
        touchRecord,
        webhookResults
      };
    },

    async listPositions() {
      return this.dbQuery(
        `SELECT
           p.*,
           c.name AS client_name,
           c.contract_expires AS contract_expires
         FROM positions p
         JOIN clients c ON c.id = p.client_id
         ORDER BY p.created_at DESC`
      );
    },

    async listClients() {
      return this.dbQuery(
        `SELECT
           c.*,
           COUNT(p.id)::int AS position_count,
           COUNT(p.id) FILTER (WHERE p.status = 'active')::int AS active_position_count,
           COALESCE(SUM(p.target_fee), 0) AS pipeline_fee
         FROM clients c
         LEFT JOIN positions p ON p.client_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC`
      );
    },

    async listCandidates(positionId = undefined) {
      if (positionId) {
        return this.dbQuery(
          `SELECT *
           FROM candidates
           WHERE position_id = $1
           ORDER BY updated_at DESC`,
          [positionId]
        );
      }
      return this.dbQuery(
        `SELECT *
         FROM candidates
         ORDER BY updated_at DESC`
      );
    },

    async getFunnel(positionId = undefined) {
      if (positionId) {
        return this.dbQuery(
          `SELECT stage, COUNT(*)::int AS candidate_count
           FROM candidates
           WHERE position_id = $1
           GROUP BY stage
           ORDER BY stage`,
          [positionId]
        );
      }
      return this.dbQuery(
        `SELECT stage, COUNT(*)::int AS candidate_count
         FROM candidates
         GROUP BY stage
         ORDER BY stage`
      );
    },

    async listTouchRecords({
      positionId = undefined,
      candidateId = undefined,
      limit = 20
    } = {}) {
      return this.dbQuery(
        `SELECT
           tr.*,
           cd.name AS candidate_name,
           cd.stage AS candidate_stage,
           p.title AS position_title,
           c.name AS client_name
         FROM touch_records tr
         LEFT JOIN candidates cd ON cd.id = tr.candidate_id
         LEFT JOIN positions p ON p.id = tr.position_id
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE ($1::uuid IS NULL OR tr.position_id = $1::uuid)
           AND ($2::uuid IS NULL OR tr.candidate_id = $2::uuid)
         ORDER BY tr.created_at DESC
         LIMIT $3`,
        [positionId || null, candidateId || null, limit]
      );
    },

    async getCandidateProfile(candidateId) {
      const [row] = await this.dbQuery(
        `SELECT
           cd.*,
           p.title AS position_title,
           p.jd_raw,
           p.target_fee,
           p.status AS position_status,
           c.id AS client_id,
           c.name AS client_name,
           c.industry AS client_industry,
           c.contract_expires,
           cp.hard_requirements,
           cp.rejection_patterns,
           cp.off_limits,
           cp.preferred_sources,
           cp.salary_ceiling
         FROM candidates cd
         JOIN positions p ON p.id = cd.position_id
         JOIN clients c ON c.id = p.client_id
         LEFT JOIN client_preferences cp ON cp.client_id = c.id
         WHERE cd.id = $1`,
        [candidateId]
      );

      return row || null;
    },

    async findSimilarSuccessfulCandidates({ positionId = undefined, candidateId = undefined, vector = [], limit = 3 } = {}) {
      const vectorLiteral = toVectorLiteral(vector);

      if (vectorLiteral) {
        try {
          return await this.dbQuery(
            `SELECT
               id,
               position_id,
               name,
               current_company,
               current_title,
               stage,
               ai_assessment,
               resume_text,
               1 - (embedding <=> $1::vector) AS similarity
             FROM candidates
             WHERE embedding IS NOT NULL
               AND ($2::uuid IS NULL OR position_id = $2::uuid)
               AND ($3::uuid IS NULL OR id <> $3::uuid)
               AND stage IN ('recommended', 'client_interview', 'offer', 'placed')
             ORDER BY embedding <=> $1::vector
             LIMIT $4`,
            [vectorLiteral, positionId || null, candidateId || null, limit]
          );
        } catch (error) {
          logger.warn?.(`[tia-repository] vector similarity query failed, using fallback ordering: ${(error as any).message}`);
        }
      }

      return this.dbQuery(
        `SELECT
           id,
           position_id,
           name,
           current_company,
           current_title,
           stage,
           ai_assessment,
           resume_text,
           NULL::numeric AS similarity
         FROM candidates
         WHERE ($1::uuid IS NULL OR position_id = $1::uuid)
           AND ($2::uuid IS NULL OR id <> $2::uuid)
           AND stage IN ('recommended', 'client_interview', 'offer', 'placed')
         ORDER BY updated_at DESC
         LIMIT $3`,
        [positionId || null, candidateId || null, limit]
      );
    }
  };
}
