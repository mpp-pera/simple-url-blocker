import { STORAGE_KEY, getList, findMatch, isBlockable } from './lib.js';

const $ = (id) => document.getElementById(id);

// The original URL is everything after the first "#" (it may contain its own "#").
const blockedUrl = location.hash.slice(1);

async function render() {
  const list = await getList();
  const match = findMatch(blockedUrl, list);

  if (blockedUrl) {
    $('url').textContent = blockedUrl;
    $('url').hidden = false;
  }

  if (match) {
    document.title = 'Blocked';
    $('title').textContent = 'This URL is blocked';
    $('reason').textContent = `It contains “${match}”, which is on your block list.`;
    $('continue').hidden = true;
  } else {
    // The entry was removed after this page was shown.
    document.title = 'No longer blocked';
    $('title').textContent = 'This URL is no longer blocked';
    $('reason').textContent = 'Its entry was removed from your block list.';
    $('continue').hidden = !isBlockable(blockedUrl);
  }
}

$('back').addEventListener('click', async () => {
  if (history.length > 1) {
    history.back();
    return;
  }
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id != null) chrome.tabs.remove(tab.id);
});

$('manage').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('continue').addEventListener('click', () => {
  location.replace(blockedUrl);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEY in changes) render();
});

render();
