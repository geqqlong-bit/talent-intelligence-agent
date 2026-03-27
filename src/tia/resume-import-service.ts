// @ts-nocheck
/**
 * Resume Import Service
 * Normalizes and imports candidate data from browser extraction into the TIA database.
 */

import crypto from 'crypto';

function generateId() {
  return crypto.randomUUID();
}

function cleanText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function parseExperience(text) {
  if (!text) return null;
  if (typeof text === 'number') return text;
  const match = String(text).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseSalary(text) {
  if (!text) return null;
  if (typeof text === 'number') return text;
  const str = String(text);
  // Match patterns like "50k", "50K", "5万", "50000"
  const kMatch = str.match(/(\d+)[kK]/);
  if (kMatch) return parseInt(kMatch[1], 10) * 1000;
  const wanMatch = str.match(/(\d+)\s*万/);
  if (wanMatch) return parseInt(wanMatch[1], 10) * 10000;
  const numMatch = str.match(/(\d{4,})/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}

export function createResumeImportService({ logger = console } = {}) {
  return {
    /**
     * Normalize raw candidate data from any platform into a standard format.
     */
    normalize(rawCandidate, { platform = 'unknown', positionId = null } = {}) {
      const now = new Date().toISOString();
      return {
        id: generateId(),
        position_id: positionId,
        name: cleanText(rawCandidate.name),
        mobile: rawCandidate.mobile || null,
        email: rawCandidate.email || null,
        current_company: cleanText(rawCandidate.current_company || rawCandidate.company),
        current_title: cleanText(rawCandidate.current_title || rawCandidate.title),
        years_experience: parseExperience(rawCandidate.years_experience || rawCandidate.experience),
        resume_text: cleanText(rawCandidate.resume_text || rawCandidate.summary || ''),
        resume_path: null,
        notes: JSON.stringify({
          source_platform: platform,
          source_url: rawCandidate.source_url || rawCandidate.profileUrl || '',
          education: rawCandidate.education || '',
          location: rawCandidate.location || '',
          active_status: rawCandidate.active_status || '',
          connection_degree: rawCandidate.connection_degree || null,
          imported_at: now
        }),
        stage: 'sourcing',
        stage_updated_at: now,
        ai_assessment: {},
        salary_current: parseSalary(rawCandidate.salary_current),
        salary_expected: parseSalary(rawCandidate.salary_expected || rawCandidate.salary),
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: now,
        updated_at: now
      };
    },

    /**
     * Normalize and prepare a batch of candidates for import.
     */
    normalizeBatch(rawCandidates, { platform = 'unknown', positionId = null } = {}) {
      if (!Array.isArray(rawCandidates)) return [];
      const results = rawCandidates
        .filter(c => c && (c.name || c.current_company))
        .map(c => this.normalize(c, { platform, positionId }));

      logger.info?.(`[tia-import] Normalized ${results.length} candidates from ${platform}`);
      return results;
    },

    /**
     * Import a single candidate or batch into the database via repository.
     * Returns import results with status for each candidate.
     */
    async importToDb(candidates, repository) {
      if (!repository) throw new Error('Repository is required for import.');

      const toImport = Array.isArray(candidates) ? candidates : [candidates];
      const results = [];

      for (const candidate of toImport) {
        try {
          // Check for duplicates by name + company
          if (candidate.name && candidate.current_company) {
            const existing = await repository.dbQuery(
              'SELECT id, name, current_company FROM candidates WHERE name = $1 AND current_company = $2 LIMIT 1',
              [candidate.name, candidate.current_company]
            ).catch(() => []);

            if (existing.length > 0) {
              results.push({
                name: candidate.name,
                status: 'skipped',
                reason: 'duplicate',
                existingId: existing[0].id
              });
              continue;
            }
          }

          const inserted = await repository.dbWrite('candidates', 'insert', candidate);
          results.push({
            name: candidate.name,
            status: 'imported',
            id: inserted?.id || candidate.id
          });
        } catch (error) {
          results.push({
            name: candidate.name,
            status: 'error',
            error: error.message
          });
        }
      }

      const imported = results.filter(r => r.status === 'imported').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error').length;

      logger.info?.(`[tia-import] Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);

      return {
        total: toImport.length,
        imported,
        skipped,
        errors,
        results
      };
    }
  };
}
