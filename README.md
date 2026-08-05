# Am I in Prod?

A Chrome extension that shows a colored environment label (e.g. `DEV`, `STAGING`, `PROD`) on top of any webpage whose URL matches a pattern you configure — so you never mistake one environment for another.

> **Not published on the Chrome Web Store.** Install it manually as an unpacked extension (see below).

## Features

- **Flexible matching** — match by substring, wildcard (`*`), or full regex, against either the hostname or the full URL.
- **Exclude patterns** — skip a rule when an additional substring is also present (e.g. match `myapp.com` but exclude `admin.myapp.com`).
- **Rule priority** — the first matching rule wins; drag rules with ⠿ in the side panel to reorder priority.
- **Custom labels** — set any text label per rule (e.g. `DEV`, `STAGING`, `PROD`, `DANGER`).
- **Custom color, opacity & size** — pick a badge color (or a preset), adjust opacity, and choose small/medium/large; text color is chosen automatically for contrast.
- **Configurable position** — pin the label to any corner of the page.
- **Draggable, dismissible badge** — drag the badge to reposition it on the page, or click it to hide it for the rest of the tab's session.
- **SPA-aware** — the badge updates automatically on single-page-app navigations (`pushState`/`replaceState`/`popstate`), not just full page loads.
- **Side panel manager** — add, edit, and delete rules with a live preview, plus a "Use current tab" shortcut to prefill the pattern.
- **Duplicate detection** — warns you inline if a new rule's pattern already matches an existing one.
- **Import / export** — back up or share your rules as a JSON file.
- **Sync or local storage** — toggle between `chrome.storage.sync` (follows you across signed-in devices, limited quota) and `chrome.storage.local` (device-only, much higher quota) from the side panel.
- **Live updates** — labels update automatically as soon as rules change, no reload required.

![Am I in Prod? UI](am-I-in-prod-UI.png)

## Installation

Since this extension isn't on the Chrome Web Store, load it manually in developer mode:

1. Download or clone this repository to a local folder.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the folder containing this repository (the one with `manifest.json`).
6. The "Am I in Prod?" extension should now appear in your extensions list.

## Usage

1. Click the extension icon in the toolbar to open the side panel.
2. Click **Add site** and fill in:
   - **URL pattern** — the string/wildcard/regex to match (e.g. `dev.myapp.com`, `*.staging.myapp.com`, `^https://prod\.`). Use **Use current tab** to prefill it from the active tab.
   - **Match type / Match against** — how the pattern is interpreted, and whether it's compared against the hostname or the full URL.
   - **Exclude pattern** — optional substring that, if present, suppresses the rule.
   - **Label, color, opacity, size, position** — how the badge looks and where it sits.
3. Click **Save**. Any open tab whose URL matches will immediately show the label.
4. Edit or delete existing rules from the list using the ✏️ and 🗑️ icons (deleting asks for confirmation). Drag ⠿ to change which rule wins when several would match.
5. On the page itself: drag the badge to move it, or click it (without dragging) to dismiss it for the rest of that tab's session.
6. Use **Export**/**Import** in the side panel to back up or restore your rules as JSON, and the **Sync rules across devices** toggle to switch between `chrome.storage.sync` and `chrome.storage.local`.

## How it works

- `content.js` runs on every top-level page (not inside iframes), matches the current URL against your saved rules using the configured match type/target, and injects a fixed-position badge when there's a match. It caches rules in memory and re-evaluates on storage changes and on SPA navigations, rather than re-reading storage on every check.
- `sidepanel.html`/`sidepanel.js`/`sidepanel.css` implement the rule management UI: add/edit/delete, drag-to-reorder, duplicate warnings, import/export, and the sync/local toggle.
- `background.js` opens the side panel when the toolbar icon is clicked.
- Rules are persisted under a `sites` key in either `chrome.storage.sync` or `chrome.storage.local` (your choice, saved in `chrome.storage.local`), and shared live between the side panel and content script via `chrome.storage.onChanged`.

## Permissions

- `storage` — to persist your rules.
- `sidePanel` — to host the rule-management UI.
- `tabs` + `host_permissions: <all_urls>` — required so the content script can read the URL of any page to match it against your rules, and so the side panel's "Use current tab" shortcut can read the active tab's URL. This extension does not send any data anywhere; everything stays in Chrome's local/sync storage.
