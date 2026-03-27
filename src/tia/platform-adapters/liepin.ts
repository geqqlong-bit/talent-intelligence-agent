// @ts-nocheck
/**
 * Platform adapter for 猎聘 (Liepin)
 * Generates browser automation instructions for searching and extracting candidates.
 */

export const PLATFORM_ID = 'liepin';
export const PLATFORM_NAME = '猎聘';
export const BASE_URL = 'https://lpt.liepin.com';

export function buildSearchUrl({ keywords, city, salaryMin, salaryMax, experience }) {
  const params = new URLSearchParams();
  if (keywords) params.set('key', keywords);
  if (city) params.set('city', city);
  if (salaryMin) params.set('salaryLower', salaryMin);
  if (salaryMax) params.set('salaryUpper', salaryMax);
  if (experience) params.set('workYearCode', experience);
  return `${BASE_URL}/cvlist/search?${params.toString()}`;
}

export function getSearchInstructions({ keywords, city, filters }) {
  return {
    platform: PLATFORM_ID,
    steps: [
      { action: 'navigate', url: buildSearchUrl({ keywords, city, ...filters }) },
      { action: 'wait', selector: '.candidate-list, .resume-list, [class*="card"]', timeout: 10000 },
      { action: 'scroll', behavior: 'smooth', delay: 2000 },
      { action: 'extract', target: 'search_results' }
    ],
    extractionRules: {
      container: '.candidate-list .candidate-item, .resume-list .resume-item, [class*="card-item"]',
      fields: {
        name: '.name, .candidate-name, [class*="name"]',
        title: '.position, .job-title, [class*="title"]',
        company: '.company, .company-name, [class*="company"]',
        experience: '.work-year, .experience, [class*="year"]',
        education: '.education, .edu, [class*="edu"]',
        salary: '.salary, .expect-salary, [class*="salary"]',
        location: '.city, .location, [class*="city"]',
        profileUrl: 'a[href*="resume"], a[href*="candidate"]'
      }
    }
  };
}

export function getDetailInstructions(profileUrl) {
  return {
    platform: PLATFORM_ID,
    steps: [
      { action: 'navigate', url: profileUrl },
      { action: 'wait', selector: '.resume-detail, .candidate-detail, [class*="detail"]', timeout: 10000 },
      { action: 'extract', target: 'candidate_detail' }
    ],
    extractionRules: {
      fields: {
        name: '.resume-name, .name, h1',
        title: '.current-position, .job-title',
        company: '.current-company, .company',
        experience: '.work-experience',
        education: '.education-info',
        salary: '.salary-expect',
        skills: '.skill-tags, .tags',
        summary: '.self-description, .summary',
        workHistory: '.work-list .work-item',
        educationHistory: '.edu-list .edu-item'
      }
    }
  };
}

export function normalizeResult(raw) {
  return {
    name: raw.name || '',
    current_company: raw.company || '',
    current_title: raw.title || '',
    years_experience: parseYears(raw.experience),
    education: raw.education || '',
    salary_expected: parseSalary(raw.salary),
    location: raw.location || '',
    source_url: raw.profileUrl || '',
    resume_text: [raw.summary, raw.workHistory, raw.skills].filter(Boolean).join('\n'),
    raw
  };
}

function parseYears(text) {
  if (!text) return null;
  const match = String(text).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseSalary(text) {
  if (!text) return null;
  const match = String(text).match(/(\d+)[kK万]/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return text.includes('万') ? value * 10000 : value * 1000;
}
