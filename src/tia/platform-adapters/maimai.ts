// @ts-nocheck
/**
 * Platform adapter for 脉脉 (Maimai)
 * Generates browser automation instructions for searching and extracting candidates.
 */

export const PLATFORM_ID = 'maimai';
export const PLATFORM_NAME = '脉脉';
export const BASE_URL = 'https://maimai.cn';

export function buildSearchUrl({ keywords, city }) {
  const params = new URLSearchParams();
  if (keywords) params.set('query', keywords);
  if (city) params.set('loc', city);
  return `${BASE_URL}/search/contacts?${params.toString()}`;
}

export function getSearchInstructions({ keywords, city, filters }) {
  return {
    platform: PLATFORM_ID,
    steps: [
      { action: 'navigate', url: buildSearchUrl({ keywords, city, ...filters }) },
      { action: 'wait', selector: '.contact-list, .search-result, [class*="result"]', timeout: 10000 },
      { action: 'scroll', behavior: 'smooth', delay: 3000 },
      { action: 'extract', target: 'search_results' }
    ],
    extractionRules: {
      container: '.contact-item, .search-result-item, [class*="contact-card"]',
      fields: {
        name: '.name, [class*="name"]',
        title: '.position, .headline, [class*="position"]',
        company: '.company, [class*="company"]',
        education: '.education, [class*="school"]',
        location: '.location, [class*="loc"]',
        connectionDegree: '.degree, [class*="degree"]',
        profileUrl: 'a[href*="/contact/"], a[href*="/n/"]'
      }
    }
  };
}

export function getDetailInstructions(profileUrl) {
  return {
    platform: PLATFORM_ID,
    steps: [
      { action: 'navigate', url: profileUrl },
      { action: 'wait', selector: '.profile-detail, .contact-profile, [class*="profile"]', timeout: 10000 },
      { action: 'extract', target: 'candidate_detail' }
    ],
    extractionRules: {
      fields: {
        name: '.profile-name, .name, h1',
        title: '.profile-position, .headline',
        company: '.profile-company, .company',
        education: '.education-info',
        skills: '.skill-list, .tags',
        summary: '.self-intro, .bio',
        workHistory: '.work-experience .exp-item',
        educationHistory: '.edu-experience .edu-item',
        connections: '.connection-count'
      }
    }
  };
}

export function normalizeResult(raw) {
  return {
    name: raw.name || '',
    current_company: raw.company || '',
    current_title: raw.title || '',
    years_experience: null,
    education: raw.education || '',
    salary_expected: null,
    location: raw.location || '',
    source_url: raw.profileUrl || '',
    resume_text: [raw.summary, raw.workHistory, raw.skills].filter(Boolean).join('\n'),
    connection_degree: raw.connectionDegree || null,
    raw
  };
}
