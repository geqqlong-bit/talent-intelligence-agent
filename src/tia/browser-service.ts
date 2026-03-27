// @ts-nocheck
/**
 * Browser Service
 * Orchestrates browser automation for candidate searching and extraction
 * across recruiting platforms (猎聘/脉脉/Boss直聘).
 *
 * This service generates structured automation instructions that can be
 * executed by OpenClaw's built-in Playwright/CDP browser engine or
 * the Chrome DevTools MCP.
 */

import { getAdapter, listPlatforms } from './platform-adapters/index.js';

const DEFAULT_LIMITS = {
  maxResultsPerSession: 30,
  dailyLimit: 100,
  actionDelay: { min: 2000, max: 5000 },
  scrollBehavior: 'smooth'
};

export function createBrowserService({ logger = console, limits = {} } = {}) {
  const config = { ...DEFAULT_LIMITS, ...limits };
  const sessionStats = {
    searchCount: 0,
    extractCount: 0,
    startedAt: new Date().toISOString()
  };

  return {
    /**
     * Generate search instructions for a given platform.
     * Returns structured data that the browser engine can execute.
     */
    search({ platform, keywords, city, filters = {} }) {
      if (!platform) throw new Error('Platform is required. Options: liepin, maimai, boss');
      if (!keywords) throw new Error('Keywords are required for search.');

      const adapter = getAdapter(platform);
      const instructions = adapter.getSearchInstructions({ keywords, city, filters });

      sessionStats.searchCount += 1;

      return {
        platform: adapter.PLATFORM_ID,
        platformName: adapter.PLATFORM_NAME,
        searchUrl: adapter.buildSearchUrl({ keywords, city, ...filters }),
        instructions,
        limits: {
          maxResults: config.maxResultsPerSession,
          actionDelay: config.actionDelay,
          scrollBehavior: config.scrollBehavior
        },
        sessionStats: { ...sessionStats },
        usage: `
To execute this search in OpenClaw:
1. Ensure you are logged into ${adapter.PLATFORM_NAME} in your Chrome browser.
2. OpenClaw will navigate to the search URL and extract results.
3. Use tia_browser_extract to parse the returned page content.
4. Use tia_resume_import to normalize and store candidates.

Rate limiting: Wait ${config.actionDelay.min}-${config.actionDelay.max}ms between page interactions.
Max results this session: ${config.maxResultsPerSession}
`.trim()
      };
    },

    /**
     * Generate extraction instructions for a candidate detail page.
     */
    extract({ platform, profileUrl, pageContent }) {
      if (!platform) throw new Error('Platform is required.');

      const adapter = getAdapter(platform);

      // If page content is an array (batch extraction from search results)
      if (Array.isArray(pageContent)) {
        const candidates = pageContent
          .slice(0, config.maxResultsPerSession)
          .map((item) => adapter.normalizeResult(item));
        sessionStats.extractCount += candidates.length;
        return {
          platform: adapter.PLATFORM_ID,
          candidates,
          count: candidates.length,
          sessionStats: { ...sessionStats }
        };
      }

      // If raw page content is provided as a single object, normalize it directly
      if (pageContent && typeof pageContent === 'object') {
        const normalized = adapter.normalizeResult(pageContent);
        sessionStats.extractCount += 1;
        return {
          platform: adapter.PLATFORM_ID,
          candidate: normalized,
          sessionStats: { ...sessionStats }
        };
      }

      // Otherwise return detail page instructions for the browser to execute
      if (!profileUrl) throw new Error('Either profileUrl or pageContent is required.');
      const instructions = adapter.getDetailInstructions(profileUrl);
      return {
        platform: adapter.PLATFORM_ID,
        instructions,
        sessionStats: { ...sessionStats }
      };
    },

    /**
     * List all supported platforms.
     */
    listPlatforms() {
      return listPlatforms();
    },

    /**
     * Get current session statistics.
     */
    getSessionStats() {
      return { ...sessionStats };
    },

    /**
     * Reset session counters (e.g., for a new day).
     */
    resetSession() {
      sessionStats.searchCount = 0;
      sessionStats.extractCount = 0;
      sessionStats.startedAt = new Date().toISOString();
    }
  };
}
