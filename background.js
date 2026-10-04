import {
  STORAGE_KEY,
  getList,
  findMatch,
  isBlockable,
  escapeRegex,
  blockedPageUrl,
} from './lib.js';

// Layer 1: declarativeNetRequest rules redirect matching page loads before
// any request is sent. The full original URL is passed to the blocked page
// in the fragment via the \0 regex substitution.
async function syncRules() {
  const list = await getList();
  const blockedPage = chrome.runtime.getURL('blocked.html');
  const addRules = [];

  for (const entry of list) {
    const regexFilter = `^.*${escapeRegex(entry)}.*$`;
    const { isSupported, reason } = await chrome.declarativeNetRequest.isRegexSupported({
      regex: regexFilter,
      isCaseSensitive: false,
    });
    if (!isSupported) {
      console.warn(`Skipping rule for "${entry}": ${reason}`);
      continue;
    }
    addRules.push({
      id: addRules.length + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: `${blockedPage}#\\0` },
      },
      condition: {
        regexFilter,
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame'],
      },
    });
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules,
  });
}

// Serialize syncs so rapid edits never race on rule IDs.
let syncChain = Promise.resolve();
function scheduleSync() {
  syncChain = syncChain.then(syncRules).catch((err) => console.error('Rule sync failed:', err));
  return syncChain;
}

function redirectTab(tabId, url) {
  chrome.tabs.update(tabId, { url: blockedPageUrl(url) }).catch(() => {});
}

// Layer 2: pages already open when an entry is added get blocked right away.
async function enforceOnOpenTabs() {
  const list = await getList();
  if (!list.length) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null && isBlockable(tab.url) && findMatch(tab.url, list)) {
      redirectTab(tab.id, tab.url);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleSync();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleSync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(STORAGE_KEY in changes)) return;
  scheduleSync().then(enforceOnOpenTabs);
});

// Layer 3: single-page apps (e.g. Reddit) change the URL with pushState and
// never make a new page request, so network rules alone can't catch them.
chrome.webNavigation.onHistoryStateUpdated.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || !isBlockable(url)) return;
  const list = await getList();
  if (findMatch(url, list)) redirectTab(tabId, url);
});
