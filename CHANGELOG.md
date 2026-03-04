# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.6.9] — 2026-03-04

### Added
- GitHub Pages landing site (`index.html`) with popup mockup, bento feature grid, voice modes showcase, and install guide
- Light / dark theme toggle on the website with `localStorage` persistence
- SVG favicon for the website tab
- Footer **Site** button in the extension popup linking to the GitHub Pages site
- Scroll-sync fix for the universal hover overlay — repositions synchronously on each scroll event to eliminate frame-lag misalignment

### Changed
- Upgraded version to `3.6.9` across `manifest.json`, `popup.html`, and `index.html`

---

## [3.6.0] — 2026-02-20

### Added
- **Universal hover overlay** — floating speed / loop / voice bar on any `<video>` element across all websites
- Global `+` / `-` keyboard shortcuts for speed control on all sites (with YouTube native skip guard)
- **Loop toggle** in the hover overlay, persisted to `chrome.storage.sync`
- **Voice Mode cycling** in the hover overlay (`Nrm → Chip → Bass → Robo → Echo`)
- `MutationObserver` to hook dynamically injected `<video>` elements (SPAs, lazy embeds)
- Per-video `play` event listener so the Web Audio `AudioContext` resumes after the first user gesture

### Changed
- Voice mode implemented as a dropdown with five options, replacing the old binary "Chipmunk Voice" checkbox
- Hover overlay repositioning switched from one-shot `requestAnimationFrame` to a continuous anchor loop

### Fixed
- UTF-8 encoding corruption in `video-hover.js` (mojibake characters replaced with HTML entities and Unicode escapes)
- Voice mode not activating on non-YouTube pages on initial page load
- Hover overlay sticking to the wrong position after scroll / resize
- Loop SVG icon clipping — shrunk to 10 px with `overflow: visible`

---

## [3.5.0] — 2026-01-15

### Added
- Custom themed dropdown for voice mode selection (no native `<select>`)
- Whole-card click activates toggle rows in the popup
- Dropdown opens upward to avoid overflowing the popup boundary

---

## [3.0.0] — 2025-12-01

### Added
- **Five Web Audio DSP voice modes**: Normal, Chipmunk, Bass Boost, Robot, Echo
- `content.js` Web Audio engine with `applyVoiceMode()`, `getOrCreateAudioChain()`, `clearChainNodes()`
- Chipmunk mode works at 1× speed (high-shelf EQ at 2500 Hz, no speed change required)

---

## [2.0.0] — 2025-10-10

### Added
- Cloud-synced video bookmarks via `chrome.storage.sync`
- Watch statistics dashboard with daily/weekly breakdown
- Content filters (hide by keyword, channel, duration)
- Auto ad-skip for YouTube pre-roll and mid-roll ads
- Precision speed dial (0.25× – 20×)
- Fully remappable keyboard shortcuts
