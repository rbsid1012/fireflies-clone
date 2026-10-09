# Fireflies reference screenshots

Captured from app.fireflies.ai (free plan, dark theme) on 2026-10-09. Used for the Phase 4+ look and layout.
Colours below were sampled from the screenshots; treat them as approximate.

## Index

| File | Shows | Used by |
|---|---|---|
| `home.png` | Home: collapsed icon rail, top bar, promo banner, quick-start cards, Recent / Upcoming / AI Feed tabs | shell, redirect target |
| `sidebar-expanded.png` | Expanded sidebar: Home, AskFred, Meetings, Tasks, AI Skills, Analytics, Voice Agents, Upgrade, Integrations, Settings, invite card | Sidebar |
| `profile-menu.png` | Avatar menu: plan/usage bars, Settings, Theme (Dark), Logout, app promos | ProfileMenu |
| `meetings-list.png` | Meetings library: Filters button, search icon, "Today" group header, meeting row card, end-of-list text | Phase 5 |
| `meetings-list-with-channels-sidebar.png` | Library with channel rail (My Meetings / All Meetings / Uploads), "Hosted by me / Shared with me" toggle | Phase 5 |
| `meetings-list-full.png` | Full library view: icon rail, channel panel, list of two meeting cards, and the right-hand "Ask Fred" panel | Phase 5 (layout reference) |
| `uploads.png` | Upload page: dashed drop zone, format/size hint, upload queue card with language select | Phase 7 |
| `meeting-info-popover.png` | Meeting info card: editable title, host, date, language, privacy, channels, invited | Phase 6/7 |
| `meeting-detail-empty.png` | Meeting detail layout: left insights rail, centre Notes / AI Skills tabs, right AskFred chat, bottom player bar (1x, -10s, play, +10s, download) | Phase 6 |
| `settings-*.png` (3) | Settings: grouped left nav, Personal/Team switch, section cards with toggles and selects | Phase 8 |
| `voice-agents-*.png` (2) | Voice Agents "Discover" page with card grid | "Coming soon" pages |
| `onboarding-*.png`, `email-meeting-recap*.png` | Signup flow and recap email | reference only |
| `_ignore/` | Not Fireflies; unrelated | - |

**Still missing:** a meeting with a real transcript (transcript lines, speaker names/colours, active-line highlight,
Overview / Action Items / Outline tabs, transcript search). The only uploaded meeting had no speech.

## Tokens (dark)

| Role | Value |
|---|---|
| Page background | `#131314` |
| Surface (sidebar, top bar, popovers) | `#1e1e1f` |
| Card / input background | `#19191a` |
| Border | `#292929` |
| Segmented control track / hover | `#292929`; selected `#48494c` |
| Primary (buttons, links, active accents) | `#623ae6` (hover slightly lighter) |
| Active nav item / selected channel | surface-raised bg, indigo text `#7f73e8` for channels |
| Promo banner | `#17152c` with indigo link |
| Upgrade button | dark green bg `#26352e`, green text |
| Brand logo | magenta/pink "F" mark; avatars are pink-red squares with a white initial |
| Quick-start cards | tinted dark: schedule `#351623` (rose), upload `#132522` (teal), capture `#17152c` (indigo) |

Typography: Inter-like sans, regular weight, ~14px body, ~13px muted secondary text; headings are medium weight, not bold.
Radii: cards/inputs ~8-12px, large hero cards ~16-20px, buttons ~6-8px. Icons are thin outline (lucide-style).

## Layout notes

- **Shell:** left sidebar ~240px (collapsible to a ~56px icon rail), top bar ~48px with page title on the left, a centred `Search by title or keyword  ⌘K` field, then plan chip ("3 Free meetings"), Upgrade, bell, and a primary split button "Capture".
- **Library:** top row = filters; list grouped by date ("Today"), each meeting a full-width rounded card with avatar tile, title, and `date · duration · host` meta.
- **Detail:** three columns under a breadcrumb bar (`#All Meetings / title`): insights rail (Smart Search, AI Filters, Sentiments, Speaker Talktime, Topic Trackers) | main (title, host, date, language, Notes / AI Skills tabs) | AskFred chat panel. Player is a full-width bottom bar.
- **Settings:** its own left nav replaces the app sidebar; content is a centred ~950px column of titled sections containing cards of rows (icon, title, description, control at right).
