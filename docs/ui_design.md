# EventMap – UI/UX design

How the app looks: style tokens, reusable components, screens and where each field and button sits. Behaviour is defined in [user_stories.md](user_stories.md), structure in [architecture.md](architecture.md); this file only covers the look. Every decision gives its reason (a user story, the spec, or a UX rule).

## 1. Design principles
| Principle | Why |
|---|---|
| **Mobile-first**, one-hand use: main actions in the bottom third of the screen | Spec: "mobile-first web app"; people look for events on the go (US-01) |
| **Map stays alive underneath**: the event card, filters and dialogs open *over* the map, never replace it | US-11: closing the card returns to the same map position, zoom and filters |
| **One component, one look**: the same Event card, Event row and Tag everywhere | US-11 "same content whichever way I opened it"; less code (DRY) |
| **Show only what exists**: no empty sections, no dead buttons | US-14 |
| **Touch targets ≥ 44×44 px**, text never only in colour | US-12; WCAG 2.1 AA |
| Light theme only in v1; all colours are tokens so a dark theme is a token swap later | KISS; no story asks for dark mode |

## 2. Design tokens (reusable style)
All components use only these tokens (CSS custom properties `--color-…`, `--space-…`). No hard-coded values in components.

### 2.1 Colour
| Token | Value | Use |
|---|---|---|
| `primary` | #2563EB | Primary buttons, active tab, cluster markers, links |
| `primary-hover` / `primary-soft` | #1D4ED8 / #EFF6FF | Hover; selected chip background |
| `text` | #0F172A | Body text |
| `text-muted` | #64748B | Meta lines (time · venue), helper text |
| `border` | #E2E8F0 | Field borders, dividers |
| `surface` | #FFFFFF | Cards, sheets, bars |
| `background` | #F8FAFC | Page background behind lists/forms |
| `danger` / `danger-soft` | #DC2626 / #FEF2F2 | Errors, Cancel event, "Cancelled" tag |
| `success` / `success-soft` | #15803D / #F0FDF4 | "Paid" tag, "You're going" |
| `live` / `live-soft` | #EA580C / #FFF7ED | "Live now" (ongoing) tag |
| `warning` / `warning-soft` | #B45309 / #FFFBEB | "Pending" request, "Full" |
| `neutral-tag` | #475569 on #F1F5F9 | "Draft", "Free" |

Why blue primary: OSM tiles are beige/green/pale-blue; a saturated blue stands out on the map, and red/green/orange stay free for status meanings. All text/background pairs meet 4.5:1 contrast.

### 2.2 Typography
System font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) — fast, native look, no font download.

| Token | Size / line-height / weight | Use |
|---|---|---|
| `title-xl` | 24 / 32 / 700 | Page titles, event card title |
| `title-l` | 20 / 28 / 600 | Section titles in sheets and forms |
| `title-m` | 16 / 24 / 600 | Event row title, dialog title |
| `body` | 16 / 24 / 400 | Body text, input text (16 px prevents iOS zoom-on-focus) |
| `body-s` | 14 / 20 / 400 | Meta lines, helper text, buttons |
| `caption` | 12 / 16 / 500 | Tags, badges, marker labels |

### 2.3 Spacing, radius, elevation, motion
- **Spacing** (4 px grid): `xs 4 · s 8 · m 12 · l 16 · xl 24 · 2xl 32`. Page side padding 16 (phone) / 24 (≥600 px).
- **Radius**: `s 6` (tags, inputs inner), `m 10` (inputs, buttons), `l 16` (cards, dialogs, sheet top corners), `pill 999` (chips, markers, badges).
- **Elevation**: `e1` subtle (rows, map pill markers), `e2` (bars, floating buttons), `e3` (sheets, dialogs). Backdrop behind sheets/dialogs: black 40 %.
- **Motion**: 150 ms for hover/press, 250 ms ease-out for sheets sliding up and dialogs fading in. Respect "reduce motion".
- **Focus ring**: 2 px `primary` outline, 2 px offset, on every interactive element.

### 2.4 Breakpoints
| Name | Width | Layout |
|---|---|---|
| Phone | < 600 | Bottom tab bar, sheets from the bottom |
| Tablet | 600–1023 | Same as phone, content max-width 640 centred |
| Desktop | ≥ 1024 | Left navigation rail, Discover splits into list panel (400 px) + map; sheets become right-side panels (480 px) |

### 2.5 Iconography
One outline icon set (e.g. Lucide), 20 px in rows/buttons, 24 px in navigation. Each sport has one icon (from `Sport.icon`). Icons that act as buttons always have an accessible label.

---

## 3. Reusable components (building blocks)
Built in three layers: **primitives → composites → domain components**. Screens only combine these; no screen draws its own button or tag.

### 3.1 Primitives
| Component | Look |
|---|---|
| **Button** | Variants: `primary` (filled blue, white text), `secondary` (white, 1 px border, dark text), `ghost` (text only), `danger` (filled red), `danger-outline` (white, red border/text). Sizes: `l` 48 px high (main actions on card/form), `m` 40 px (dialogs, list actions), `s` 32 px (inline, only inside a 44 px hit area). Radius `m`, label `body-s` 600, optional leading icon. `fullWidth` option. Disabled = 40 % opacity, no shadow. Loading = spinner replaces icon, label stays. |
| **IconButton** | 44×44 hit area, 24 px icon, round, ghost background; optional `CountBadge` top-right. |
| **TextField** | Label above (body-s 600), input 48 px high, 1 px `border`, radius `m`, 12 px inner padding. Optional helper text below (muted). Error state: red border + red message with ⚠ icon below (body-s). Required fields show " *" after the label. Never placeholder-only labels. |
| **TextArea** | As TextField, min 4 rows, grows with content, character counter bottom-right when a limit exists. |
| **Select** | As TextField with chevron on the right; opens native picker on phone. |
| **DateTimeField** | As TextField, calendar icon on the right; native date/time picker. |
| **Checkbox** | 20 px box inside a 44 px row, label to the right, whole row tappable. |
| **SegmentedControl** | 2–3 equal segments, 40 px high, pill radius, selected = white surface + e1 shadow on a grey track. Used for Map/List, Free/Paid. |
| **Chip** | Pill, 36 px high (44 px hit area), body-s. Unselected: white + border. Selected: `primary-soft` bg, `primary` border/text, ✓ or ✕ icon. |
| **Tag** | Small pill label, 22 px high, `caption` uppercase-free, coloured soft bg + strong text. Variants: `cancelled` (danger), `paid` (success), `live` (live, with a pulsing dot), `full`/`pending` (warning), `draft`/`free` (neutral). Always text + colour. |
| **CountBadge** | Red circle 18 px, white `caption` number, "9+" above 9. |
| **Spinner / Skeleton** | Skeleton blocks in the shape of the row/card being loaded (grey shimmer). |

### 3.2 Composites
| Component | Look |
|---|---|
| **Sheet** | The single overlay container. Phone: slides up from the bottom, max 92 % of screen height, top radius `l`, grey drag handle (36×4) centred at top, header row (title left, ✕ IconButton right), scrollable body, optional **sticky footer** for actions. Desktop: 480 px panel on the right edge, full height. The map stays visible behind. |
| **Dialog** | Centred, max-width 400 px, radius `l`, padding 24. Title (`title-m`), body text, buttons bottom: phone = stacked full-width (primary on top); desktop = right-aligned in a row. |
| **ConfirmDialog** | Dialog preset: "Are you sure?" title, one-sentence consequence, `secondary` "Keep" + `danger` confirm button (e.g. "Cancel attendance"). Used by US-06, US-10, US-25. |
| **ActionBar** | Sticky bottom bar inside a Sheet or form: white, top border, padding 12/16, holds 1–3 Buttons, respects the phone's safe area. |
| **Section** | Titled block: `title-l` heading, 8 px gap, content; 24 px between sections. Hidden entirely if empty (US-14). |
| **InfoRow** | 20 px icon (muted) + primary text (body) + optional secondary line (body-s muted). 44 px min height. Used for date, venue, price, attendees. |
| **ListRow** | 72 px min height row, 16 px padding, left slot (48 px tile), centre (title + meta), right slot (tags/price/chevron), divider below. Whole row tappable, hover = `background`. |
| **EmptyState** | Centred: 48 px muted icon, `title-m` heading, body-s text, 1–2 Buttons. |
| **Banner** | Full-width strip inside a page/sheet: soft colour background, icon, one line of text, optional action link. Variants match Tag colours. |
| **Toast** | Dark pill at bottom centre (above the tab bar), white body-s text, optional "Undo"/action link, disappears after 4 s. |
| **TopBar** | 56 px, white, e2 shadow. Left: back arrow or logo; centre/left: page title or SearchBox; right: up to 2 IconButtons. |
| **TabBar** (phone) / **NavRail** (desktop) | Phone: 64 px bottom bar, 3–4 items, icon 24 + label caption, active = `primary`, inactive = muted. Desktop: 80 px vertical rail on the left, same items. |
| **Fab** | 56 px round `primary` button with "+" icon, bottom-right, 16 px above the TabBar, e2 shadow; extended version shows label "Create event". |

### 3.3 Domain components (EventMap-specific, built from the above)
| Component | Built from | Look |
|---|---|---|
| **PriceLabel** | text / Tag | "Free" as `free` Tag, or "2 500 HUF" in body-s 600. Same everywhere. |
| **DateTimeRange** | text | "Sat 15 Nov · 14:00–16:00" + muted "(Budapest time)" when the venue zone differs from the viewer. Multi-day: "15 Nov 14:00 – 16 Nov 12:00". |
| **SportBadge** | icon + text | 48 px rounded-square tile with the sport icon on `primary-soft` (in rows) or small chip "⚽ Football" (on the card). |
| **StatusTags** | Tag row | Ordered: Cancelled → Live now → Paid → Full. Shown at the top of cards and right side of rows. |
| **EventRow** | ListRow + SportBadge + PriceLabel + StatusTags | Left: SportBadge. Centre: title (`title-m`, 1 line, "…"), meta line "Sat 14:00 · Margaret Island Stadium" (body-s muted, 1 line), third line distance "2.4 km" (caption muted, Discover only). Right: PriceLabel on top, tags under it. Used in List tab, My events, cluster list, drafts (with variations below). |
| **EventMarker** | pill | White pill, 32 px high (44 px invisible hit area), e1 shadow: sport icon 20 px + title in caption 600, max ~18 characters then "…", plus small ⓘ icon. Selected marker = `primary` fill, white text. (US-12) |
| **ClusterMarker** | circle | `primary` circle with white bold count. 40 px (2–9), 48 px (10–99), 56 px (100+), 3 px white ring. (US-13) |
| **ClusterList** | Sheet (small) | When events share one venue: small sheet "5 events at Margaret Island" with EventRows (no distance line). (US-13) |
| **EventCard** | Section, InfoRow, Tags, ActionBar | See §5.3. One component for map/list/My events/inbox/preview. |
| **RsvpActions** | Buttons + Checkbox | The action area of the EventCard; see §5.3. |
| **FilterChips** | Chips | Horizontal scrolling row: `Today ▾`, `Sport ▾`, `Price ▾`, `10 km ▾`, then `Clear` ghost link when anything differs from default. |
| **InboxRow** | ListRow | Unread: 8 px blue dot left + bold title; read: normal weight. Icon by kind (calendar-x cancelled, pencil changed, shield admin, user-check approved/rejected). Meta: relative time ("2 h ago"). |
| **ChangeList** | list | Inside an opened message: each changed field as "Start · ~~Sat 14:00~~ → **Sat 16:00**" (old struck-through muted, new bold). (US-22) |
| **RequestCard** | card | Admin: username (title-m), email + "Member since" (body-s muted), "Requested 2 days ago", buttons Reject (`danger-outline` m) and Approve (`primary` m) right-aligned. (US-21) |

---

## 4. App shell & navigation

```
Phone                                   Desktop (≥1024)
┌───────────────────────────┐           ┌────┬──────────────┬──────────────────────┐
│ TopBar (56)               │           │Nav │ List panel   │ Map                  │
├───────────────────────────┤           │rail│ 400 px       │                      │
│                           │           │80px│ search,      │   (card opens as     │
│   page content            │           │    │ filters, rows│    right panel 480)  │
│                           │           │    │              │                      │
│                      (+)  │ ← Fab     │    │              │                      │
├───────────────────────────┤           │    │              │                      │
│ TabBar (64)               │           └────┴──────────────┴──────────────────────┘
└───────────────────────────┘
```

**Tabs per role** (max 4, Why: thumb reach and US-07/19/20/22 visibility rules)
| Role | Tabs |
|---|---|
| Visitor | Discover · Log in |
| Attendee | Discover · My events · Inbox (CountBadge) · Account |
| Organizer | same as Attendee + **Fab "Create event"** on Discover and My events; "My drafts" inside Account |
| Admin | Discover · Moderation · Account (no My events, no Inbox items target admins, US-19) |

Why the inbox is a tab, not only a top-bar icon: US-22 needs an always-visible unread counter; the tab icon carries the CountBadge.

### 4.1 Menu (TabBar / NavRail)
```
Phone – TabBar, 64 px, fixed to the bottom, white, top border, e2 shadow
┌──────────────┬──────────────┬──────────────┬──────────────┐
│     🗺       │     📅       │    ✉ (3)     │     👤       │  icon 24 px, CountBadge on Inbox
│  Discover    │  My events   │    Inbox     │   Account    │  label caption 12 px
└──────────────┴──────────────┴──────────────┴──────────────┘
   active item: icon + label `primary`, 3 px `primary` bar on top of the item
   inactive: `text-muted`; every item fills its quarter (≥ 44 px wide and high)

Desktop – NavRail, 80 px wide, full height, left edge
┌────────┐
│  Logo  │  32 px app logo, 24 px from the top
│        │
│  🗺    │  item = 64 px square: icon 24 + caption label under it
│Discover│  active: `primary-soft` rounded background + `primary` icon/label
│  📅    │
│My events│
│  ✉ (3) │
│ Inbox  │
│        │
│  👤    │  Account pinned to the bottom of the rail
│Account │
└────────┘
```
- Items appear in the order of the role table above; the rail and the bar always have the same items. Why: one menu model on all screen sizes, so users don't relearn the navigation.
- No hamburger menu. Why: with at most 4 destinations every item fits on screen, and hidden menus are used less (one tap instead of two).
- The menu is hidden on the Event form (§5.10) and on Log in / Register (§5.6). Why: these are focused tasks; the sticky ActionBar takes the bottom of the screen.

Each tab and screen has its own URL; see §8 URL routing.

---

## 5. Screens

**Main components checklist** – the ten main parts of the app and where each is designed:
| Main component | Section | Shown as |
|---|---|---|
| Map | §5.1 (+ List view §5.2, City prompt §5.4, Filters §5.5) | Discover tab, full-bleed map |
| Event card | §5.3 | Sheet over the current screen |
| Menu | §4.1 | Bottom TabBar (phone) / NavRail (desktop) |
| Login page | §5.6 – Log in | Full page, centred card |
| Registration form (user sign-up) | §5.6 – Register | Full page, centred card |
| My account | §5.9 | Account tab |
| My events (list) | §5.7 | My events tab |
| In-app inbox | §5.8 | Inbox tab |
| Event registration form (create / edit an event) | §5.10 | Full page form |
| Organizer's planned events (not published) | §5.11 "My drafts" | Page opened from Account |

The admin-only Moderation page (§5.12) and the Not found page (§5.13) come from US-21/17/18 and §8.5 in addition to these ten.

### 5.1 Discover – Map view (US-01, 02, 03, 04, 12, 13, 24)
```
┌───────────────────────────────┐
│ [🔍 Search events…        ] 🎚│  TopBar: SearchBox (flex) + Filter IconButton (badge = active filters)
│ [Today▾][Sport▾][Price▾][10 km▾] Clear │  FilterChips row, 52 px, scrolls sideways
│ ( Map | List )      12 events │  SegmentedControl left, result count right (body-s 600)
├───────────────────────────────┤
│        ┌─────────────┐        │
│   (5)  │⚽ Sunday 5-a…ⓘ│      │  Markers / clusters on the full-bleed map
│        └─────────────┘        │
│              ◉ you            │  blue dot = user / city centre, faint radius circle
│                           [◎] │  "Locate me" IconButton, bottom-right above Fab
│                          (+)  │  Fab (organizers only)
├───────────────────────────────┤
│ Discover  My events  Inbox  Me│
└───────────────────────────────┘
```
- SearchBox: 44 px, pill radius, search icon left, ✕ clear button right when text present (US-24).
- Result count always visible next to Map|List — Why: AC 2 "count = markers = list entries".
- Radius shown as a faint `primary` 10 %-opacity circle on the map, so users see why far events are missing (US-01).
- Zoom +/- controls: desktop only (phones pinch).
- **Empty result** (US-03): map stays, a floating card centred near the bottom: EmptyState "No events found" / "Try a wider radius or fewer filters." / buttons `secondary` "Widen to 25 km", `ghost` "Clear filters". Filters stay tappable above it.

### 5.2 Discover – List view (US-23)
Same header (search, chips, Map|List, count). Body: `background` colour, EventRows on white. Ongoing events grouped under a small sticky label "Happening now", then "Upcoming" grouped by day ("Today", "Tomorrow", "Sat 15 Nov"). Desktop: this is the permanent left panel next to the map; hovering a row highlights its marker.

### 5.3 Event card (US-05, 06, 08, 11, 14, 16, 17, 18, 19)
Opens as a **Sheet** (phone: from the bottom, 92 % height; desktop: right panel 480 px). Not a full page, so the map stays behind it (US-11). Has its own URL, `/events/:id` (§8.4).
```
┌───────────────────────────────┐
│           ───                 │  drag handle
│ [↗ Share]                [✕] │  header IconButtons
│ [CANCELLED] [LIVE NOW] [PAID] │  StatusTags (only those that apply)
│ ⚽ Football                    │  SportBadge chip
│ Sunday 5-a-side Cup           │  title-xl, up to 3 lines
│                               │
│ 🕑 Sat 15 Nov · 14:00–16:00   │  InfoRows
│ 📍 Margaret Island Stadium    │
│    Margitsziget, Budapest     │  (address as secondary line)
│ 🏷 2 500 HUF   /  Free         │
│ 👥 12 going · 30 spots        │  + thin progress bar when capacity set
│ ─────────────────────────────│
│ About this event              │  Section: description (hidden if empty)
│ About the sport               │  Section: explainer, or muted italic "No description yet"
│ Organizer                     │  Section: name + row of 44 px social IconButtons (hidden if none)
│                               │
├───────────────────────────────┤  ActionBar (sticky, see variants)
│ [ I'm going  (primary, l) ][Get tickets]│
│ ☐ I have paid                 │
└───────────────────────────────┘
```
**ActionBar variants** (only one set is shown; Why: US-14/19 "only actions that apply")
| Viewer / state | ActionBar content |
|---|---|
| Visitor or attendee, not going | `primary l` "I'm going" (flex) + `secondary l` "Get tickets" ↗ / "Register" ↗ when links exist |
| Going | Success line "✓ You're going" + `danger-outline m` "Cancel my attendance" |
| Paid event, logged in non-admin | extra Checkbox row "I have paid" under the buttons (US-08) |
| Full | Disabled "I'm going" with `full` Tag "Event is full" |
| Owner organizer | Extra row above: `secondary m` "✎ Edit" + `danger-outline m` "Cancel event" |
| Admin | `secondary m` "Edit" + `danger-outline m` "Cancel event"; "Get tickets"/"Register" still shown; no "I'm going"/checkbox (US-19) |
| Cancelled | Red Banner at the top "This event has been cancelled"; whole card text muted; no action buttons (US-14) |
| Preview mode (US-15) | Yellow Banner "Preview – not published yet"; ActionBar replaced by `secondary` "Back to editing" + `primary` "Publish" |

External link buttons show a small ↗ icon so users know they leave the app.

### 5.4 City prompt (US-04)
Dialog (cannot be dismissed without a city) over a greyed map: icon 📍, title "Where are you looking for events?", TextField "City" (autofocus, placeholder "e.g. Budapest"), `primary l fullWidth` "Show events". Error under the field: "City not found". Later reachable via a "📍 Budapest ▾" chip at the start of FilterChips; opened from the chip it can be closed and also offers `secondary` "Use my location".

### 5.5 Filter sheet (US-02)
Opened by the filter IconButton (all filters in one place) — each chip in FilterChips opens just its own section in a small sheet.
- **Date**: Chips `Today` `Tomorrow` `This weekend` `Pick dates…` (shows two date fields, From / To: the filter works on whole days).
- **Sport**: multi-select Chips with sport icons, wrapping grid.
- **Price**: SegmentedControl `Any | Free | Paid`; when Paid, a "Max price" TextField with currency suffix.
- **Distance**: slider 1–50 km with value label "10 km" above the thumb.
- ActionBar: `ghost` "Reset" left, `primary l` "Show 12 events" right (live count). Why: user sees the result before closing.

### 5.6 Log in / Register
Two separate full pages with the same layout: a white card, max-width 400 px, centred on the `background` colour, padding 24, radius `l`. No TabBar; a ✕ / back arrow at top-left returns to the previous screen. Why: logging in is a short, focused task, usually started from "I'm going" (US-06).

**Log in**
```
┌───────────────────────────────┐
│ ←                             │  back IconButton
│                               │
│          [ Logo 48 ]          │  centred
│            Log in             │  title-xl, centred
│                               │
│ ┌ ℹ Log in to RSVP to       ┐ │  blue Banner, only when redirected
│ └   Sunday 5-a-side Cup     ┘ │  from "I'm going" (US-06)
│                               │
│ Username                      │  TextField, 48 px, autofocus
│ [                           ] │
│ Password                      │  TextField + eye IconButton inside
│ [                       👁  ] │  the right edge (show / hide)
│                               │
│ ┌ ⚠ Wrong username or      ┐ │  red Banner, only after a failed attempt
│ └   password               ┘ │
│ [         Log in          ]   │  `primary l fullWidth`
│                               │
│   No account? Create one      │  body-s, "Create one" is a link → Register
└───────────────────────────────┘
```

**Register**
```
┌───────────────────────────────┐
│ ←                             │
│          [ Logo 48 ]          │
│        Create account         │  title-xl, centred
│                               │
│ Username *                    │  TextField, helper "Shown to organizers"
│ [                           ] │
│ Email *                       │  TextField, email keyboard on phones
│ [                           ] │
│ Password *                    │  TextField + eye IconButton
│ [                       👁  ] │
│                               │  field errors: red text under the field
│ [      Create account     ]   │  `primary l fullWidth`
│                               │
│ Already have an account? Log in│ body-s link → Log in
└───────────────────────────────┘
```
- Fields match the backend sign-up form (username, email, password). Error messages under a field (e.g. "Username already taken") use the red TextField error state; general errors use the red Banner above the button.
- After registering, the user is logged in and returns to where they came from (`next`, §8.2).

### 5.7 My events (US-07, 08)
TopBar title "My events". List of EventRows, "Happening now" group first, then by day. Row extras: `paid` Tag, `cancelled` Tag (row dimmed to 60 %) with a `ghost s` "Remove from my events" button on the right. EmptyState: "No plans yet" / "Find something on the map." / `primary` "Discover events".
```
┌───────────────────────────────┐
│ My events                     │  TopBar, title-xl
├───────────────────────────────┤
│ HAPPENING NOW                 │  sticky group label, caption, `live` colour
│ [⚽] Sunday 5-a-side Cup  Free│  EventRow, 72 px
│      Sat 14:00 · Margaret Isl.│
│      [LIVE NOW]               │
│ SAT 15 NOV                    │  group label per day, caption muted
│ [🤺] Fencing Open    2 500 HUF│
│      Sat 18:00 · BOK Hall     │
│      [PAID]                   │  `paid` Tag (US-08)
│ ░[🏃] Night Run   [CANCELLED]░│  dimmed row 60 %
│ ░     Sun 20:00 · City Park  ░│
│ ░          [Remove from my events]│ `ghost s`, right-aligned
├───────────────────────────────┤
│ Discover  My events  Inbox  Me│
└───────────────────────────────┘
```
- No distance line in rows here (distance only matters while discovering).
- Tapping a row opens the Event card Sheet over this list (US-11).

### 5.8 Inbox (US-22)
TopBar "Inbox". InboxRows newest first. Tapping expands the row in place (accordion): full text, ChangeList, admin reason in a quoted grey box, and `secondary s` "Open event" link (opens EventCard sheet). EmptyState: "No messages yet".
```
┌───────────────────────────────┐
│ Inbox                         │  TopBar, title-xl
├───────────────────────────────┤
│ ● ✏ Sunday 5-a-side Cup     ⌄│  unread: blue dot + bold title
│     was changed · 2 h ago     │  meta body-s muted
│   ┌─────────────────────────┐ │  expanded content (accordion)
│   │ Start  ~~14:00~~ → 16:00│ │  ChangeList: old struck-through, new bold
│   │ Venue  ~~BOK~~ → Arena  │ │
│   └─────────────────────────┘ │
│   [Open event]                │  `secondary s`
│ ─────────────────────────────│
│   ✖ Night Run was cancelled  ›│  read: normal weight, no dot
│     yesterday                 │
│ ─────────────────────────────│
│   ✔ Your organizer request   ›│  account message, no "Open event"
│     was approved · 3 d ago    │
├───────────────────────────────┤
│ Discover  My events  Inbox(1) Me│
└───────────────────────────────┘
```
- Only one message is expanded at a time. Why: keeps the list scannable on a phone.
- Admin messages show the reason in a grey quoted box under the ChangeList (US-17/18).

### 5.9 Account (US-20, 25)
```
┌───────────────────────────────┐
│ Account                       │  TopBar, title-xl
├───────────────────────────────┤
│ (A)  anna_k                   │  56 px initial circle + username title-l
│      anna@example.com         │  email body-s muted
│      [ORGANIZER]              │  role Tag
│                               │
│ ┌ Organizing ──────────────┐  │  white Section card, radius l
│ │ ➕ Create event         › │  │  ListRow 56 px
│ │ 📝 My drafts (3)        › │  │  ListRow 56 px, count in muted text
│ └──────────────────────────┘  │
│   – or, for an attendee –     │
│ ┌ Want to publish events? ─┐  │
│ │ Ask an admin for organizer│  │  body-s muted
│ │ rights.                   │  │
│ │ [ Become an organizer ]   │  │  `primary m`
│ └──────────────────────────┘  │
│                               │
│ [ Log out ]                   │  `ghost`, danger text colour, left-aligned
├───────────────────────────────┤
│ Discover  My events  Inbox  Me│
└───────────────────────────────┘
```
- Header block: 56 px initial-letter circle, username (title-l), email (body-s muted), role Tag (Attendee / Organizer / Admin).
- **Organizer section** (state-dependent card):
  - not requested / rejected: text "Want to publish events?" + `primary m` "Become an organizer" (rejected also shows a muted line "Your last request was rejected").
  - pending: `pending` Tag + "Your request is being reviewed."
  - organizer: menu rows (ListRow with chevron) "➕ Create event", "📝 My drafts (3)".
- Bottom: `ghost` "Log out" (danger text colour).
- Admin: no organizer section (US-19).

### 5.10 Event form – Create / Edit / Draft (US-09, 15, 16, 17, 25)
Full page (not a sheet, Why: long form needs the full screen and keyboard space). Max-width 720 centred on desktop. TopBar: ✕ close (asks to confirm if there are unsaved changes), title "New event" / "Edit event".

Form is split into white **Section cards** (radius `l`, padding 16, 16 gap):
1. **Basics** – Title * (TextField, counter /100), Sport * (Select with icons).
2. **When** – Start * and End * (DateTimeFields side by side ≥600 px, stacked on phone).
3. **Where** – Venue name *, Address *, **VenuePicker**: 200 px map with a draggable pin and hint "Drag the pin to the exact spot".
4. **Price** – SegmentedControl `Free | Paid` *; Paid shows Amount (numeric) + Currency (Select, 96 px) in one row, then Ticket link. Free hides the ticket link (US-09).
5. **About** – Description (TextArea), Sport explainer (TextArea, helper "Explain the sport for newcomers").
6. **Links & capacity** – Registration link, Capacity (numeric, helper "Leave empty for unlimited"), **SocialLinksEditor**: repeating rows `[Label ▾][URL][🗑]` + `ghost s` "+ Add link".

```
┌───────────────────────────────┐
│ ✕  New event                  │  TopBar, no TabBar on this page
├───────────────────────────────┤  page background `background`
│ ┌ Basics ──────────────────┐  │  Section card
│ │ Title *          12/100  │  │
│ │ [Sunday 5-a-side Cup   ] │  │
│ │ Sport *                  │  │
│ │ [⚽ Football          ▾] │  │
│ └──────────────────────────┘  │
│ ┌ When ────────────────────┐  │
│ │ Start *       End *      │  │  side by side ≥ 600 px
│ │ [15 Nov 14:00][15 Nov 16:00]│
│ │ ⚠ End must be after start│  │  red error under the field
│ └──────────────────────────┘  │
│ ┌ Where ───────────────────┐  │
│ │ Venue name * / Address * │  │
│ │ ┌──────────────────────┐ │  │
│ │ │   map 200 px   📍    │ │  │  VenuePicker
│ │ └──────────────────────┘ │  │
│ └──────────────────────────┘  │
│ ┌ Price ───────────────────┐  │
│ │ ( Free | Paid )          │  │
│ │ [2500      ] [HUF ▾]     │  │  only when Paid
│ │ Ticket link [https://…]  │  │  only when Paid
│ └──────────────────────────┘  │
│ ┌ About ┐ ┌ Links & capacity ┐│  (stacked on phone)
├───────────────────────────────┤
│ To publish, fill in: Venue    │  muted line
│ [Save as draft][Preview][Publish]│ ActionBar, sticky
└───────────────────────────────┘
```

Validation look: red border + message under the exact field (US-09/16). Required-but-empty fields are **not** red until the user tries Publish; instead a muted line above the ActionBar lists them: "To publish, fill in: Venue, Price".

**ActionBar** (sticky bottom):
- Create / draft: `secondary l` "Save as draft" · `ghost l` "Preview" · `primary l` "Publish" (Publish & Preview disabled while required fields are missing; all disabled while any field is invalid).
- Edit: `ghost l` "Discard" · `primary l` "Save changes". Small info line: "12 attendees will be notified of changes." (US-16).

### 5.11 My drafts – the organizer's planned, unpublished events (US-25)
TopBar "My drafts" + Fab "Create event". EventRows with `draft` Tag, meta "Last edited 2 h ago", missing title shown as muted italic "Untitled draft", trash IconButton on the right → ConfirmDialog "Delete this draft?".
```
┌───────────────────────────────┐
│ ←  My drafts                  │  TopBar with back arrow to Account
├───────────────────────────────┤
│ [⚽] Spring Football Cup   🗑 │  EventRow: SportBadge, title, trash IconButton
│      Sat 22 Mar · no venue yet│  meta: whatever is filled, else "not set"
│      [DRAFT] Edited 2 h ago   │  `draft` Tag + muted time
│ ─────────────────────────────│
│ [ ? ] Untitled draft       🗑 │  muted italic when no title; grey "?" tile
│      [DRAFT] Edited 3 d ago   │  when no sport
│                               │
│                  (+ Create event)│ extended Fab
└───────────────────────────────┘
```
- Tapping a row opens the Event form (§5.10) with the saved values, not the Event card. Why: a draft is unfinished work; the next step is editing (US-25).
- The name "My drafts" is kept from US-25 so the label in the app matches the user stories.

### 5.12 Moderation – admin (US-21, 17, 18)
TopBar "Moderation", Tabs underneath: `Organizer requests (3)` | `Audit log`.
- Requests: stack of RequestCards; EmptyState "No pending requests".
- Audit log: compact rows: action icon + "**admin1** cancelled *Sunday Cup*" + time; tap expands ChangeList / reason.
- **Admin cancel dialog** (US-18): Dialog "Cancel this event?", required TextArea "Reason (sent to the organizer)", `danger` "Cancel event" disabled until a reason is typed.

### 5.13 Not found / error
EmptyState centred on the page: "This page doesn't exist" + `primary` "Back to the map". Network errors: Toast "Something went wrong. Try again." (US-03 "no error page" for empty results).

---

## 6. Feedback & micro-states
| Moment | Look |
|---|---|
| Loading map results | Thin `primary` progress line under TopBar; markers stay until new ones arrive |
| Loading lists / card | Skeleton rows / skeleton card |
| RSVP done | Button turns into "✓ You're going", Toast "You're going! Added to My events" |
| Cancelled attendance, removed, published, saved draft | Toast with short confirmation |
| Destructive actions | Always ConfirmDialog with red confirm button (US-06, 10, 18, 25) |

## 7. User story → screen/component map
| Story | Where it is seen |
|---|---|
| US-01, 04, 12, 13 | Discover map (§5.1), City prompt (§5.4), EventMarker, ClusterMarker |
| US-02, 03, 24 | FilterChips, Filter sheet, SearchBox, EmptyState |
| US-23 | Discover list (§5.2), EventRow |
| US-05, 11, 14 | EventCard (§5.3) |
| US-06, 08 | RsvpActions in the EventCard ActionBar |
| US-07 | My events (§5.7) |
| US-22 | Inbox (§5.8), InboxRow, ChangeList, Inbox tab badge |
| US-20 | Account organizer section (§5.9) |
| US-09, 15, 16, 25 | Event form (§5.10), Preview mode, My drafts (§5.11) |
| US-10, 17, 18 | EventCard owner/admin rows, ConfirmDialog, Admin cancel dialog |
| US-19 | Role-based tabs (§4) and ActionBar variants |
| US-21 | Moderation (§5.12), RequestCard |
| US-06, 11, 15, 16 (URLs) | URL routing (§8): `/events/:id`, `?next=`, `?preview=1`, edit redirect |

---

## 8. URL routing
Every **page** and the **event card** has a URL; small transient overlays do not. Why: a URL is needed where a user may reload, share, bookmark or press Back (US-11 "the card has its own URL"); giving one to every dialog would fill the browser history with steps nobody wants to return to.

### 8.1 Route table
| URL | Screen (§) | Who can open it | Tab highlighted |
|---|---|---|---|
| `/` | Discover – Map view (5.1) | everyone | Discover |
| `/list` | Discover – List view (5.2) | everyone | Discover |
| `/events/:id` | Event card (5.3) as a Sheet over the screen it was opened from | everyone (drafts: owner only) | the tab underneath |
| `/events/new` | Event form – create (5.10) | organizer | Account |
| `/events/:id/edit` | Event form – edit published event, or continue a draft (5.10) | owner organizer, admin (not drafts) | Account |
| `/login` | Log in (5.6) | logged out | Log in |
| `/register` | Register (5.6) | logged out | Log in |
| `/my-events` | My events (5.7) | attendee, organizer | My events |
| `/inbox` | Inbox (5.8) | attendee, organizer | Inbox |
| `/account` | Account (5.9) | logged in | Account |
| `/account/drafts` | My drafts (5.11) | organizer | Account |
| `/admin` | redirects to `/admin/requests` | admin | Moderation |
| `/admin/requests` | Moderation – Organizer requests tab (5.12) | admin | Moderation |
| `/admin/audit-log` | Moderation – Audit log tab (5.12) | admin | Moderation |
| anything else | Not found (5.13) | everyone | none |

Naming rules: lowercase, nouns, plural for collections, `kebab-case` for multi-word paths. The `/events/:id` paths use the same id and shape as the API's `/api/v1/events/{id}` (architecture.md §3), so one id works in both. Why: predictable URLs, and no translation step between the frontend and the API. The SPA never uses paths that start with `/api`, because nginx sends those to the backend (frontend/AGENTS.md).

### 8.2 Query parameters
| Parameter | Used on | Values | Why it is in the URL |
|---|---|---|---|
| `q` | `/`, `/list` | search text | US-24; a shared link shows the same results |
| `date` | `/`, `/list` | `today` (default, omitted) · `tomorrow` · `weekend` · `YYYY-MM-DD..YYYY-MM-DD` | US-02 |
| `sport` | `/`, `/list` | sport slugs, comma-separated, e.g. `fencing,football` | US-02 (multi-select) |
| `price` | `/`, `/list` | `free` · `paid` (omitted = any) | US-02 |
| `max_price` | `/`, `/list` | number, only with `price=paid` | US-02 |
| `radius` | `/`, `/list` | km, 1–50 (default 10, omitted) | US-01 |
| `city` | `/`, `/list` | city name, only when location was denied | US-04; reloading does not ask for the city again |
| `next` | `/login`, `/register` | a relative path of this app, e.g. `/events/42` | US-06: return to the card after logging in |
| `preview` | `/events/new`, `/events/:id/edit` | `1` | US-15: browser Back closes the preview and keeps the form |

- **Default values are left out of the URL**, so the default view is simply `/` (US-02 "clear filters → default view").
- **Switching Map ⇄ List keeps the query string** (`/?sport=football` ⇄ `/list?sport=football`). Why: US-02 / US-23 say the filters apply to both views.
- **Map centre and zoom are not in the URL.** They stay in memory while the app is open. Why: panning would rewrite the URL on every move; US-11 only requires returning to the same position, which the Sheet overlay already does (the map is never unmounted).
- `next` accepts only paths that start with `/` and not `//`, so a login link can't send users to another site (open-redirect protection).

### 8.3 What has no URL
City prompt (5.4), Filter sheet (5.5), Cluster list, ConfirmDialog, Admin cancel dialog, Toasts and the expanded state of an Inbox row. These are short steps inside one screen; Back or ✕ simply closes them.

### 8.4 How the event card route behaves (US-11)
| Opened from | URL | What is behind the Sheet | ✕ / Back goes to |
|---|---|---|---|
| Map marker or cluster list | `/events/42` | the map, same position, zoom and filters | `/?…filters` |
| List tab | `/events/42` | the list, same scroll position | `/list?…filters` |
| My events / Inbox "Open event" | `/events/42` | My events / Inbox | `/my-events` / `/inbox` |
| A pasted or shared link (no previous screen) | `/events/42` | the default map, centred on the event | `/` |

- Opening a card from inside the app **adds** a history entry, so the phone's Back gesture closes the card instead of leaving the app.
- Moving from one card to another (e.g. via the cluster list) **replaces** the entry, so one Back always returns to the screen underneath.
- A cancelled event's link still opens the card with the "Cancelled" Banner (US-10/11). An unknown id, or someone else's draft, shows the Not found screen (same as the API's 404).

### 8.5 Access rules for routes
| Situation | Result | Why |
|---|---|---|
| Logged-out user opens a page that needs login (`/my-events`, `/inbox`, `/account…`, `/events/new`, `/events/:id/edit`, `/admin…`) | Redirect to `/login?next=<that path>` | US-06 "redirected to login"; after logging in they land where they wanted |
| Logged-in user opens `/login` or `/register` | Redirect to `next` or `/` | The form is useless when already logged in |
| Logged-in user without the right role (e.g. admin on `/my-events`, attendee on `/events/new` or `/admin`) | Not found screen (5.13) | US-19/09/21: the page "is not shown"; matches the API's 403/404 instead of showing a page with no actions |
| `/events/:id/edit` for a cancelled or ended event | Redirect to `/events/:id` (the card) | US-16 "cannot be edited" |
| `/events/:id/edit` for a draft opened by an admin | Not found | US-25: drafts are never visible to admins |

The navigation (§4) only shows links the user can open, so these rules matter only for typed, bookmarked or shared URLs.
