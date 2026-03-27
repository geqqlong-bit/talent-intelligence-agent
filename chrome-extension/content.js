// content.js - TIA Browser Hunter
// Injected into maimai.cn, liepin.com, zhipin.com

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }
  
  if (request.type === 'EXTRACT_PROFILE') {
    try {
      const data = extractProfile();
      sendResponse(data);
    } catch (e) {
      console.error('[TIA Hunter] Extraction failed', e);
      sendResponse(null);
    }
    return true; // async
  }
});

function extractProfile() {
  const url = window.location.href;
  
  if (url.includes('zhipin.com')) return extractBoss();
  if (url.includes('maimai.cn')) return extractMaimai();
  if (url.includes('liepin.com')) return extractLiepin();
  
  return null;
}

// ── Boss Zhipin ──
function extractBoss() {
  const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
  
  // Typically Boss detail selectors vary between web and recruiter mode.
  // Below covers general classes often seen.
  const name = getText('.name, h1.name, .detail-name, .resume-name');
  const title = getText('.expect-position, .resume-custom-title') || getText('.item-text'); 
  const company = getText('.company-name, .work-content h4') || '';
  const experienceText = getText('.work-year, .resume-item-exp'); 
  const salaryText = getText('.salary, .expect-salary');
  
  // Capture the whole text for AI to parse later
  const summary = document.querySelector('.resume-detail, .geek-detail')?.innerText || document.body.innerText.substring(0, 3000);
  
  return {
    name,
    current_title: title,
    current_company: company,
    years_experience: experienceText, // String, backend will parse
    salary_current: null,
    salary_expected: salaryText,
    resume_text: summary,
    source_url: window.location.href
  };
}

// ── Maimai ──
function extractMaimai() {
  const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
  
  const name = getText('.name, .u-name');
  // Maimai usually has title and company strictly separate or combined
  const titleCompanyObj = document.querySelectorAll('.work-exp .item');
  const currentWork = titleCompanyObj[0]?.textContent || getText('.profession');
  
  return {
    name,
    current_title: currentWork, // Needs parsing on backend or just send string
    current_company: '', // Usually derived from currentWork
    resume_text: document.querySelector('.profile-container')?.innerText || document.body.innerText.substring(0, 3000),
    source_url: window.location.href
  };
}

// ── Liepin ──
function extractLiepin() {
  const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
  
  const name = getText('.name-text, h1');
  const title = getText('.job-title, .work-position');
  const company = getText('.company-name');
  
  return {
    name,
    current_title: title,
    current_company: company,
    resume_text: document.querySelector('.resume-content, .wrap-box')?.innerText || document.body.innerText.substring(0, 3000),
    source_url: window.location.href
  };
}
