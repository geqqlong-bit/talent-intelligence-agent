// @ts-nocheck
/**
 * Platform adapter for Boss 直聘 (Boss Zhipin)
 * Generates browser automation instructions for searching and extracting candidates.
 */

export const PLATFORM_ID = 'boss';
export const PLATFORM_NAME = 'Boss直聘';
export const BASE_URL = 'https://www.zhipin.com';

export function buildSearchUrl({ keywords, city, experience, education }) {
  const params = new URLSearchParams();
  if (keywords) params.set('query', keywords);
  if (city) params.set('city', city);
  if (experience) params.set('experience', experience);
  if (education) params.set('degree', education);
  return `${BASE_URL}/web/geek/recommend?${params.toString()}`;
}

export function getSearchInstructions({ keywords, city, filters }) {
  return {
    platform: PLATFORM_ID,
    steps: [
      { action: 'navigate', url: buildSearchUrl({ keywords, city, ...filters }) },
      { action: 'wait', selector: '.geek-list, .recommend-list, [class*="card-list"]', timeout: 10000 },
      { action: 'scroll', behavior: 'smooth', delay: 3000 },
      { action: 'extract', target: 'search_results' }
    ],
    extractionRules: {
      container: '.geek-card, .candidate-card, [class*="geek-item"]',
      fields: {
        name: '.geek-name, .name, [class*="name"]',
        title: '.geek-expect, .expect-position, [class*="expect"]',
        company: '.geek-company, .company, [class*="company"]',
        experience: '.geek-work-year, [class*="work-year"]',
        education: '.geek-edu, [class*="edu"]',
        salary: '.geek-salary, [class*="salary"]',
        activeStatus: '.geek-active, [class*="active"]',
        location: '.geek-city, [class*="city"]',
        profileUrl: 'a[href*="/geek/"], a[href*="/resume/"]'
      }
    },
    antiDetection: {
      note: 'Boss 直聘反爬最强，验证码频繁。建议单次搜索 ≤ 20 条，操作间隔 ≥ 3s。',
      maxResultsPerSession: 20,
      minActionDelay: 3000
    }
  };
}

export function getDetailInstructions(profileUrl) {
  return {
    platform: PLATFORM_ID,
    steps: [
      { action: 'navigate', url: profileUrl },
      { action: 'wait', selector: '.geek-detail, .resume-detail, [class*="detail"]', timeout: 10000 },
      { action: 'extract', target: 'candidate_detail' }
    ],
    extractionRules: {
      fields: {
        name: '.detail-name, .name, h1',
        title: '.detail-expect, .expect-position',
        company: '.detail-company',
        experience: '.detail-work',
        education: '.detail-edu',
        salary: '.detail-salary, .expect-salary',
        activeStatus: '.active-time',
        skills: '.skill-list, .tag-list',
        summary: '.self-intro, .geek-desc',
        workHistory: '.work-exp .exp-item',
        educationHistory: '.edu-exp .edu-item',
        projectHistory: '.project-exp .project-item'
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
    active_status: raw.activeStatus || '',
    source_url: raw.profileUrl || '',
    resume_text: [raw.summary, raw.workHistory, raw.projectHistory, raw.skills].filter(Boolean).join('\n'),
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
