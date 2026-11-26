---
name: Meridian
description: A personal agent for a model you already host.
colors:
  burnished-copper: "oklch(0.78 0.12 65)"
  copper-pressed: "oklch(0.47 0.11 50)"
  copper-mark: "oklch(0.52 0.12 50)"
  ink-on-copper: "oklch(0.2 0.02 60)"
  paper-on-copper: "oklch(0.98 0.01 90)"
  ring-day: "oklch(0.58 0.12 55)"
  field-sage: "oklch(0.75 0.07 160)"
  field-sage-ink: "oklch(0.42 0.07 160)"
  night-study: "oklch(0.18 0.012 70)"
  warm-paper: "oklch(0.965 0.012 85)"
  lamp-ink: "oklch(0.95 0.015 85)"
  walnut-ink: "oklch(0.25 0.02 60)"
  raised-night: "oklch(0.22 0.014 68)"
  card-paper: "oklch(0.985 0.008 90)"
  drawer: "oklch(0.16 0.01 68)"
  drawer-paper: "oklch(0.955 0.012 85)"
  drawer-active: "oklch(0.26 0.014 68)"
  note: "oklch(0.28 0.014 68)"
  note-paper: "oklch(0.93 0.015 85)"
  muted-night: "oklch(0.27 0.012 68)"
  quiet: "oklch(0.74 0.02 80)"
  quiet-day: "oklch(0.48 0.02 65)"
  hairline: "oklch(0.4 0.02 70 / 55%)"
  hairline-day: "oklch(0.86 0.02 80)"
  input-fill: "oklch(0.42 0.02 70 / 45%)"
  wash: "oklch(0.32 0.02 70)"
  alarm: "oklch(0.7 0.14 28)"
  alarm-day: "oklch(0.5 0.16 30)"
  map-destination: "#c47a3a"
  map-stay: "#6a8f72"
  map-poi: "#8d7355"
  map-transit: "#9a8f80"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "1.75rem"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.14em"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  "2xl": "1.125rem"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  nameplate:
    textColor: "{colors.lamp-ink}"
  button-primary:
    backgroundColor: "{colors.burnished-copper}"
    textColor: "{colors.ink-on-copper}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklch, oklch(0.78 0.12 65) 80%, transparent)"
    textColor: "{colors.ink-on-copper}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.note}"
    textColor: "{colors.lamp-ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.lamp-ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-destructive:
    backgroundColor: "color-mix(in oklch, oklch(0.7 0.14 28) 20%, transparent)"
    textColor: "{colors.alarm}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  input:
    backgroundColor: "color-mix(in oklch, oklch(0.42 0.02 70 / 45%) 30%, transparent)"
    textColor: "{colors.lamp-ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  composer:
    backgroundColor: "{colors.raised-night}"
    textColor: "{colors.lamp-ink}"
    rounded: "{rounded.2xl}"
    padding: "8px"
  user-bubble:
    backgroundColor: "{colors.note}"
    textColor: "{colors.lamp-ink}"
    rounded: "{rounded.2xl}"
    padding: "12px 16px"
  nav-item:
    backgroundColor: "{colors.drawer-active}"
    textColor: "{colors.lamp-ink}"
    rounded: "{rounded.lg}"
    padding: "8px"
  sidebar-tab:
    textColor: "{colors.lamp-ink}"
    typography: "{typography.label}"
    padding: "0 0 2px"
  status-chip:
    backgroundColor: "color-mix(in oklch, oklch(0.75 0.07 160) 15%, transparent)"
    textColor: "{colors.field-sage}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Meridian

## Overview

**Creative North Star: "The Warm Desk"**

Meridian is a private desk for one person and the model they already run. Night Study is the ground the app boots into, warm and dark. Warm Paper is the same desk with the lamp on. Fraunces is the nameplate. Geist is the work. The mood is quiet and warm, and a pop of color is welcome when it is Burnished Copper or Field Sage.

Depth is a step of tone. The drawer sits a shade under the canvas, a card sits a shade above it, and a hairline finishes the edge. Controls are short, gently curved, and they press down one pixel. Copper marks the action: buttons, icons, the active underline, links, selection, and the context meter. Sage marks what is reachable, live, or confirmed.

The desk refuses a hosted-product look. No purple brand, no neon, and no frosted panels. The composer dock and the dialog scrim are the only translucency, and both stay faint. The map's four colors stay on the map.

**Key Characteristics:**

- Night Study by default, Warm Paper as the same desk with the lamp on
- Fraunces for the name and section titles, Geist for the work, Geist Mono for tools and measures
- Two pops of color: Burnished Copper for action and marks, Field Sage for live or confirmed
- Tonal steps and hairlines, with shadow reserved for the slash menu and map pins
- Compact controls: 32px buttons, 10px corners, and a 1px press

## Colors

The palette is a warm desk in two lights. Night Study is the default, because the page boots with the `dark` class unless `meridian-theme` in local storage is `light`. Warm Paper is the lit face of the same wood, not a second brand. Token values live in `app/globals.css` on `:root` and `.dark`.

### Primary

- **Burnished Copper** (`oklch(0.78 0.12 65)`): the mark you see in Night Study. Primary buttons, studio icons, tool names, links, the active tab underline, the focus ring, text selection at 30% copper, and the context meter. In this theme `--primary`, `--copper`, and `--ring` are this one color.
- **Burnished Copper, pressed** (`oklch(0.47 0.11 50)`): the primary button on Warm Paper, darkened so it holds on a light ground. This is `--primary` in light.
- **Burnished Copper, mark** (`oklch(0.52 0.12 50)`): icons and links on Warm Paper. This is `--copper` in light, a step lighter than the button so a mark is not a second button.
- **Ink on Copper** (`oklch(0.2 0.02 60)`): the label on a copper button in Night Study.
- **Paper on Copper** (`oklch(0.98 0.01 90)`): the label on a copper button on Warm Paper.
- **Ring Day** (`oklch(0.58 0.12 55)`): the focus ring on Warm Paper. Night Study uses Burnished Copper for the ring.

### Secondary

- **Field Sage** (`oklch(0.75 0.07 160)`): reachable, live, or confirmed, in Night Study. The health dot when LM Studio answers, a live fare, and a saved status.
- **Field Sage, on paper** (`oklch(0.42 0.07 160)`): the same tick on Warm Paper.

### Neutral

- **Night Study** (`oklch(0.18 0.012 70)`): the canvas in the dark theme.
- **Warm Paper** (`oklch(0.965 0.012 85)`): the canvas in the light theme.
- **Lamp Ink** (`oklch(0.95 0.015 85)`): text on Night Study.
- **Walnut Ink** (`oklch(0.25 0.02 60)`): text on Warm Paper.
- **Raised Night** (`oklch(0.22 0.014 68)`): cards, popovers, the composer field, and the desk in Night Study.
- **Card Paper** (`oklch(0.985 0.008 90)`): the same raised surface on Warm Paper.
- **Drawer** (`oklch(0.16 0.01 68)`): the sidebar in Night Study, one step under the canvas.
- **Drawer Paper** (`oklch(0.955 0.012 85)`): the sidebar on Warm Paper.
- **Note** (`oklch(0.28 0.014 68)`): your own messages, and a selected mode button, in Night Study.
- **Note Paper** (`oklch(0.93 0.015 85)`): your own messages on Warm Paper.
- **Quiet** (`oklch(0.74 0.02 80)`) and **Quiet Day** (`oklch(0.48 0.02 65)`): secondary text, placeholders, and idle labels.
- **Hairline** (`oklch(0.4 0.02 70 / 55%)`) and **Hairline Day** (`oklch(0.86 0.02 80)`): borders and dividers.
- **Alarm Red** (`oklch(0.7 0.14 28)`) and **Alarm Red, on paper** (`oklch(0.5 0.16 30)`): errors and a failed health check. This is an alarm, not a third brand voice.

Hovers, the slash-menu selection, and the dark input fill use the neighboring tones in the frontmatter: Drawer Active, Muted Night, Accent Wash, and Input Fill.

The trip map keeps its own legend, stored as hex in `lib/travel-types.ts`: **Map Destination** (`#c47a3a`), **Map Stay** (`#6a8f72`), **Map Place** (`#8d7355`), and **Map Transit** (`#9a8f80`).

### Named Rules

**The Two Voices Rule.** Burnished Copper is the action and the mark. Field Sage is live, reachable, or confirmed. A pop of either is welcome. A third accent is not, and neither voice becomes a gradient or a glow.

**The Map Legend Rule.** Destination, stay, place, and transit colors exist only on the trip map and its key. They do not move into buttons, links, or chrome.

## Typography

**Display Font:** Fraunces (with Georgia, then serif)
**Body Font:** Geist (with ui-sans-serif, system-ui, then sans-serif)
**Label/Mono Font:** Geist for labels. Geist Mono (with ui-monospace, then monospace) for tool names, file names, commands, and the context meter.

**Character:** Fraunces is a soft serif nameplate. Geist is a plain grotesque for everything you read and press. Geist Mono is how the desk writes down a measurement. The three do not trade jobs.

### Hierarchy

- **Display** (400, 3rem, line-height 1, tracking -0.025em): the empty-chat name, and nowhere else.
- **Headline** (400, 1.5rem, line-height 1): section titles such as Desk, Image Studio, Settings, Tools, Map, and Fares.
- **Title** (400, 1.25rem, line-height 1): the title of the open conversation. Dialog titles are the same face at 1rem, medium (500).
- **Body** (400, 15px, line-height 1.75rem): conversation text. The column stops at 48rem. Assistant text may run to 46rem, and your own message stops at 40rem. Controls and navigation use 14px medium (500).
- **Label** (400, 11px, tracking 0.14em, uppercase): sidebar tabs, section kickers, and status words that are not sentences. The collapsed desk rail uses the same style at 0.18em. A live fare pill is 10px.

The sidebar nameplate is Fraunces at 1.65rem, line-height 1, tracking -0.025em. It is the name on the drawer, between the empty-state display and a section title.

### Named Rules

**The Nameplate Rule.** Fraunces is for the product name and section titles. Sentences, controls, and lists are Geist. Tool names, file names, commands, and the context meter are Geist Mono.

**The Label Rule.** A label that is not a sentence is 11px, uppercase, and tracked out 0.14em.

## Layout

The frame is three widths. The sidebar is 18.5rem. The conversation column stops at 48rem (`max-w-3xl`), with 16px of page padding and 24px from the `md` breakpoint up. The desk is 24rem, and its collapsed rail is 2.75rem. The app is a full-height row. The page does not scroll as a document. Each pane scrolls on its own.

Under 48rem the sidebar covers the work and a 40% black scrim sits behind it. From 48rem it is part of the row. Under 80rem the desk covers the work the same way. From 80rem it sits in the row. Image Studio splits its settings from the results at a 760px container. Travel splits the conversation from the map at an 860px container.

The working rhythm is 4, 8, 10, 12, 16, 20, and 24px. Control padding is 10px. Stacks inside a pane are usually 8px. Page padding is 16px, and the wide page inset is 24px. Message groups are 24px apart.

### Named Rules

**The Frame Rule.** The sidebar is 18.5rem, the desk is 24rem, and the conversation stops at 48rem. Under 48rem the sidebar covers the work. Under 80rem the desk covers the work.

## Elevation & Depth

Depth is tonal. In Night Study the drawer is one step under the canvas and a card is one step above it. On Warm Paper the same relationship holds in lighter wood. A hairline closes the edge. Surfaces are opaque. The composer dock is the canvas at 90% with a small blur, because it sits over scrolling text. The dialog scrim is 10% black with an extra-small blur. Dialogs themselves are an opaque raised surface with a 1px ring at 10% of the ink, and they do not cast a shadow.

Motion is short. Controls use a 150ms standard ease. The desk width eases out over 200ms. Chevrons turn over 150ms. Dialogs fade and scale over 100ms. A pressed button moves down 1px. When the person asks for reduced motion, durations collapse and the binary decode is removed. State still changes.

The binary decode is the one ornamental motion: a live status can settle out of a column of glyphs. It is not a decoration for ordinary labels.

### Shadow Vocabulary

- **Slash menu** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): the menu that opens above the composer. It is also bordered and opaque.
- **Map pin** (`box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3)`, plus a 2px white border): the halo on a trip marker. It is not a surface shadow.

### Named Rules

**The Tonal Step Rule.** A surface changes depth by stepping to the next warm tone and drawing a hairline. It does not lift off the desk.

**The Floating Menu Rule.** The slash menu is the one panel that casts a shadow. Map pins are the one mark with a halo.

## Shapes

Corners come from a 10px base (`0.625rem`). Controls, inputs, and nav rows use that 10px. Tight groups, such as the mode switch, use 8px. Panels, dialogs, and image cards use 14px. The composer and your own messages use 18px. Pills are for file chips, fare badges, and the health dot, not for buttons.

Focus on a component is a 3px ring at half the ring color, and the border shifts to the ring color. A bare control with no component ring gets a 2px solid ring, offset 2px. An invalid field uses Alarm Red for that ring. Text selection is Burnished Copper at 30%.

### Named Rules

**The Three Corners Rule.** 10px for controls, 14px for panels and dialogs, 18px for the composer and your own messages. Pills are for chips and status.

## Components

Controls feel tactile and compact. They are short, medium weight, and they press. They do not grow, glow, or lift.

### Buttons

- **Shape:** 10px corners (8px in a tight group). Default height 32px. Icon buttons in the header are 28px square. The mode switch is 24px tall.
- **Primary:** Burnished Copper with Ink on Copper, 10px horizontal padding, 14px medium type. A 16px icon may sit beside the label. Hover mixes the copper down to 80%. Press moves the button down 1px. Disabled is 50% opacity.
- **Hover / Focus:** color shift and the 3px ring. No shadow, no scale.
- **Secondary:** Note fill with Lamp Ink. Used for a selected mode.
- **Ghost:** transparent, and a muted wash on hover. Used for icon buttons and unselected modes.
- **Destructive:** Alarm Red text on a 20% wash in Night Study, and a 10% wash on Warm Paper. Hover deepens the wash. It is not a solid alarm button.

### Chips

- **Style:** a pill. File chips use a muted fill and Geist Mono. A live fare uses Field Sage text on a 15% sage wash, at 10px, uppercase.
- **State:** a live chip is sage. An idle chip is muted. The health dot is a 6px circle: Field Sage when reachable, Alarm Red when unreachable, Burnished Copper while unknown.

### Cards / Containers

- **Corner Style:** 14px for image cards and dialogs. 18px for the composer.
- **Background:** Raised Night, or Card Paper in the light theme. The dialog is the same surface as a popover.
- **Shadow Strategy:** none. See Elevation & Depth.
- **Border:** a hairline. Dialogs use a 1px ring at 10% ink instead of a shadow.
- **Internal Padding:** 16px in a dialog. 8px inside the composer. Image cards crop flush and keep the radius by clipping.

### Inputs / Fields

- **Style:** 32px tall, 10px corners, 10px horizontal padding, a hairline, and a transparent ground. In Night Study the ground is Input Fill at 30%. Placeholder text is Quiet.
- **Focus:** the border becomes the ring color and a 3px ring appears at half strength. The composer textarea drops its own ring, because the field around it is the frame.
- **Error / Disabled:** an invalid field takes an Alarm Red border and ring. Disabled is 50% opacity, and the ground darkens.

### Navigation

The sidebar nameplate is the Fraunces nameplate. Under it, Image Studio and Travel Planner are 14px rows with 8px padding, 10px corners, and a Burnished Copper icon. The active row is Drawer Active. Hover is that wash at 60%. Chats and Projects are label tabs with a copper underline on the active one. The list rows are the same 10px corners, and the active conversation carries a 6px copper dot.

The desk is the right-hand pane. Its title is a headline. Collapsed, it is a vertical label on a 2.75rem rail. The theme toggle is a ghost icon button in the sidebar header.

### Composer

The composer is the signature control. A hairline field with 18px corners sits on a dock that is 90% of the canvas. Inside it: the textarea, then a row with the Agent / Ask / Plan switch, a quiet status line, and Send. Send is the primary button. Stop and Retry are outline. Your own messages come back as Note bubbles at 18px corners, 12px by 16px of padding, and 15px type on a 28px line.

### Empty state

An empty chat is the display name, one sentence in Quiet, and a primary button. It is a nameplate on the desk, not a campaign.

## Do's and Don'ts

### Do:

- **Do** boot in Night Study. Warm Paper is the same desk with the lamp on.
- **Do** use Burnished Copper for primary buttons, mark icons, the active underline, links, text selection, and the context meter.
- **Do** use Field Sage for reachable, live, and confirmed.
- **Do** keep conversation text at 15px on a 28px line, inside a column that stops at 48rem.
- **Do** draw focus as a 3px ring at half the ring color, and move a pressed button down 1px.
- **Do** leave motion short, and remove it when the person asks for reduced motion.

### Don't:

- **Don't** use purple, neon, or frosted glass on panels, cards, or menus.
- **Don't** add a third accent. The map legend stays on the map.
- **Don't** put drop shadows on cards, the sidebar, the desk, or dialogs.
- **Don't** set Fraunces on buttons, inputs, labels, or body copy.
- **Don't** grow controls, round them into pills, or lift them on hover.
