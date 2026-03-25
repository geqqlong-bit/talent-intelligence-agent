/**
 * Platform adapter registry
 * Central access point for all recruiting platform adapters.
 */

import * as liepin from './liepin.mjs';
import * as maimai from './maimai.mjs';
import * as boss from './boss.mjs';

const ADAPTERS = {
  liepin,
  maimai,
  boss
};

const PLATFORM_NAMES = {
  liepin: '猎聘',
  maimai: '脉脉',
  boss: 'Boss直聘'
};

export function getAdapter(platform) {
  const key = String(platform || '').toLowerCase().replace(/[\s直聘]/g, '');
  // Normalize Chinese names to adapter keys
  const aliasMap = {
    '猎聘': 'liepin',
    '脉脉': 'maimai',
    'boss': 'boss',
    'boss直聘': 'boss',
    'zhipin': 'boss',
    'liepin': 'liepin',
    'maimai': 'maimai'
  };

  const normalizedKey = aliasMap[platform] || aliasMap[key] || key;
  const adapter = ADAPTERS[normalizedKey];
  if (!adapter) {
    throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.keys(PLATFORM_NAMES).join(', ')}`);
  }
  return adapter;
}

export function listPlatforms() {
  return Object.entries(PLATFORM_NAMES).map(([id, name]) => ({
    id,
    name,
    baseUrl: ADAPTERS[id].BASE_URL
  }));
}

export { liepin, maimai, boss };
