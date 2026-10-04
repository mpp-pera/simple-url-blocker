// Shared helpers used by the background worker and all extension pages.

export const STORAGE_KEY = 'blockedList';
export const MAX_ENTRIES = 1000; // Chrome allows at most 1000 regex rules.
export const MAX_ENTRY_LENGTH = 500;

// Lowercase, trim, and drop a leading scheme and "www." so that pasting
// "https://www.reddit.com/r/news" stores the broader "reddit.com/r/news".
export function normalizeEntry(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^www\./, '');
}

export async function getList() {
  const { [STORAGE_KEY]: list } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(list) ? list.filter((e) => typeof e === 'string' && e) : [];
}

export async function saveList(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

// Accepts one or many entries separated by whitespace or commas.
// Returns { added: string[], skipped: { entry, reason }[] }.
export async function addEntries(input) {
  const candidates = String(input ?? '')
    .split(/[\s,]+/)
    .map(normalizeEntry)
    .filter(Boolean);
  const list = await getList();
  const added = [];
  const skipped = [];

  for (const entry of candidates) {
    if (entry.length > MAX_ENTRY_LENGTH) {
      skipped.push({ entry, reason: 'too long' });
      continue;
    }
    const cover = list.find((e) => entry.includes(e));
    if (cover) {
      skipped.push({
        entry,
        reason: cover === entry ? 'already in the list' : `already blocked by “${cover}”`,
      });
      continue;
    }
    if (list.length >= MAX_ENTRIES) {
      skipped.push({ entry, reason: 'the list is full' });
      continue;
    }
    list.unshift(entry);
    added.push(entry);
  }

  if (added.length) await saveList(list);
  return { added, skipped };
}

export async function removeEntry(entry) {
  const list = await getList();
  const index = list.indexOf(entry);
  if (index === -1) return -1;
  list.splice(index, 1);
  await saveList(list);
  return index;
}

export async function restoreEntry(entry, index) {
  const list = await getList();
  if (list.includes(entry)) return;
  list.splice(Math.max(0, Math.min(index, list.length)), 0, entry);
  await saveList(list);
}

export function findMatch(url, list) {
  const target = String(url ?? '').toLowerCase();
  return list.find((entry) => target.includes(entry)) ?? null;
}

export function isBlockable(url) {
  return /^https?:\/\//i.test(String(url ?? ''));
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function blockedPageUrl(url) {
  return `${chrome.runtime.getURL('blocked.html')}#${url}`;
}

export function describeResult({ added, skipped }) {
  const parts = [];
  if (added.length === 1) parts.push(`Blocked “${added[0]}”.`);
  else if (added.length > 1) parts.push(`Blocked ${added.length} entries.`);
  for (const { entry, reason } of skipped) parts.push(`“${entry}” skipped: ${reason}.`);
  return { text: parts.join(' ') || 'Nothing to add.', ok: added.length > 0 };
}
