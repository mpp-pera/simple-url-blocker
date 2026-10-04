# URL Blocker

A simple Chrome extension that blocks any page whose address contains text from your block list.

If `reddit.com/r/news` is on the list, all of these are blocked:

- `https://www.reddit.com/r/news`
- `https://old.reddit.com/r/news/top?t=day`
- `http://anything.reddit.com/r/news.whatever`

Matching ignores upper/lower case. When you add `https://www.example.com`, the `https://` and `www.` are dropped so the entry also matches the bare domain.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension from the puzzle-piece menu so its icon is always visible.

## Use

- **Click the icon** to block the current site, add an entry, or open **Edit blocked list**.
- **Edit blocked list** shows every entry. From there you can add several at once, filter, remove (with undo), and test whether a URL would be blocked.
- A blocked page shows the URL and which entry it matched.

## How it works

- `background.js` turns each entry into a `declarativeNetRequest` redirect rule, so matching pages never load. They go straight to `blocked.html`.
- Tabs that are already open are checked whenever the list changes.
- Single-page apps that change the URL without loading a new page (Reddit, YouTube, …) are caught with `webNavigation.onHistoryStateUpdated`.
- The list lives in `chrome.storage.local` under `blockedList`, with a maximum of 1000 entries.
