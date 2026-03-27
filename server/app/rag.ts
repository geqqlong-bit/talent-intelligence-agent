// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';

let cachedKb = null;
let cachedKbPath = null;

async function loadKnowledgeBase(kbPath) {
  if (cachedKb && cachedKbPath === kbPath) return cachedKb;
  try {
    const data = await fs.readFile(kbPath, 'utf8');
    cachedKb = JSON.parse(data);
    cachedKbPath = kbPath;
    return cachedKb;
  } catch {
    return null;
  }
}

/**
 * Retrieve domain knowledge (salary benchmarks, target companies, industry insights)
 * for a given role title and industry.
 *
 * @param {string} roleTitle - The role to look up
 * @param {string} industry - The industry to look up
 * @param {object} [options] - Optional config
 * @param {string} [options.knowledgeBasePath] - Override path to knowledge-base.json
 * @param {string} [options.cwd] - Working directory base for relative resolution
 */
export async function getDomainKnowledge(roleTitle, industry, options = {}) {
  try {
    const baseCwd = options.cwd || process.cwd();
    const kbPath = options.knowledgeBasePath || path.resolve(baseCwd, 'server/data/knowledge-base.json');
    const kb = await loadKnowledgeBase(kbPath);
    if (!kb) return '';

    const normalizedRole = (roleTitle || '').toLowerCase();
    const normalizedIndustry = (industry || '').toLowerCase();

    // Match benchmarks — try exact match first, then partial
    let result = '';
    const benchmarkKeys = Object.keys(kb.benchmarks || {});
    const roleKey = benchmarkKeys.find(k => normalizedRole === k.toLowerCase())
      || benchmarkKeys.find(k => normalizedRole.includes(k.toLowerCase()))
      || benchmarkKeys.find(k => k.toLowerCase().includes(normalizedRole) && normalizedRole.length >= 2);

    if (roleKey) {
      const b = kb.benchmarks[roleKey];
      result += `\n\n[EXPERT RAG INJECTION]\nHistorical Benchmarks for ${roleKey}:\n- Salary Range: ${b.salary_range}\n- Typical Target Companies: ${b.competitors.join(', ')}\n- Key Traits Needed: ${b.key_traits.join(', ')}`;
    }

    // Match industries — try exact match first, then partial
    const industryKeys = Object.keys(kb.industries || {});
    const industryKey = industryKeys.find(k => normalizedIndustry === k.toLowerCase())
      || industryKeys.find(k => normalizedIndustry.includes(k.toLowerCase()))
      || industryKeys.find(k => k.toLowerCase().includes(normalizedIndustry) && normalizedIndustry.length >= 2);

    if (industryKey) {
      result += `\n\n[EXPERT RAG INJECTION]\nIndustry Expert Insights for ${industryKey}: ${kb.industries[industryKey]}`;
    }

    return result;
  } catch (error) {
    console.error('RAG Retrieval Error:', error);
    return '';
  }
}
