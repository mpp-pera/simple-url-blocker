import {
  STORAGE_KEY,
  getList,
  addEntries,
  removeEntry,
  restoreEntry,
  findMatch,
  describeResult,
} from './lib.js';

const $ = (id) => document.getElementById(id);

let list = [];
let undo = null; // { entry, index }
let toastTimer = null;

function showMessage(text, kind = '') {
  const el = $('message');
  el.textContent = text;
  el.className = `message ${kind}`;
}

function renderList() {
  const filter = $('filter').value.trim().toLowerCase();
  const visible = filter ? list.filter((e) => e.includes(filter)) : list;
  const ul = $('list');

  $('count').textContent = String(list.length);
  ul.replaceChildren(
    ...visible.map((entry) => {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.className = 'mono';
      text.textContent = entry;
      const remove = document.createElement('button');
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${entry}`);
      remove.addEventListener('click', () => onRemove(entry));
      li.append(text, remove);
      return li;
    }),
  );

  ul.hidden = visible.length === 0;
  const empty = $('empty');
  empty.hidden = visible.length > 0;
  empty.textContent = list.length
    ? 'No entries match the filter.'
    : 'Nothing blocked yet. Add your first entry above.';
  renderTest();
}

function renderTest() {
  const value = $('test-input').value.trim();
  const el = $('test-result');
  if (!value) {
    el.textContent = '';
    el.className = 'message test-result';
    return;
  }
  const match = findMatch(value, list);
  el.textContent = match ? `Blocked by “${match}”.` : 'Not blocked.';
  el.className = `message test-result ${match ? 'error' : 'ok'}`;
}

function showToast(text) {
  $('toast-text').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  $('toast').hidden = true;
  undo = null;
}

async function onRemove(entry) {
  const index = await removeEntry(entry);
  if (index === -1) return;
  undo = { entry, index };
  showToast(`Unblocked “${entry}”`);
}

async function load() {
  list = await getList();
  renderList();
}

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
  input.focus();
});

$('toast-undo').addEventListener('click', async () => {
  if (undo) await restoreEntry(undo.entry, undo.index);
  hideToast();
});

$('filter').addEventListener('input', renderList);
$('test-input').addEventListener('input', renderTest);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEY in changes) load();
});

load();
$('add-input').focus();
