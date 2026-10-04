import {
  STORAGE_KEY,
  getList,
  addEntries,
  findMatch,
  isBlockable,
  normalizeEntry,
  describeResult,
} from './lib.js';

const $ = (id) => document.getElementById(id);

let currentHost = null; // normalized, used when adding
let currentHostname = null; // raw, used for matching

function showMessage(text, kind = '') {
  const el = $('message');
  el.textContent = text;
  el.className = `message ${kind}`;
}

async function render() {
  const list = await getList();
  $('count').textContent = `${list.length} blocked`;

  if (!currentHost) return;
  const match = findMatch(currentHostname, list);
  const status = $('current-status');
  status.hidden = !match;
  status.className = 'status blocked';
  status.textContent = match ? `Blocked by “${match}”` : '';
  $('block-current').hidden = Boolean(match);
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && isBlockable(tab.url)) {
    currentHostname = new URL(tab.url).hostname;
    currentHost = normalizeEntry(currentHostname);
    $('current-host').textContent = currentHost;
    $('current').hidden = false;
  }
  await render();
  $('add-input').focus();
}

$('block-current').addEventListener('click', async () => {
  const { text, ok } = describeResult(await addEntries(currentHost));
  showMessage(text, ok ? 'ok' : 'error');
});

$('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('add-input');
  if (!input.value.trim()) {
    showMessage('Type part of a URL to block.', 'error');
    return;
  }
  const { text, ok } = describeResult(await addEntries(input.value));
  showMessage(text, ok ? 'ok' : 'error');
  if (ok) input.value = '';
});

$('manage').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEY in changes) render();
});

init();
