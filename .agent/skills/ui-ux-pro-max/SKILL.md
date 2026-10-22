---
name: ui-ux-pro-max
description: Elite UI/UX Design & Frontend Engineering Engine for FlowPOS Pro. Crafts agency-grade, high-contrast, tactile, cashier-speed interfaces with perfect RTL Arabic typography, micro-interactions, and zero layout shift.
status: standby
mode: on-demand
---

# UI/UX Pro Max — Elite Design System & Ergonomics Engine

> **STATUS: STANDBY (Ready on-demand)**  
> This skill remains dormant during standard bug fixes and surgical tasks. It is activated when the user requests UI/UX improvements, redesigns, new screens, or visual polishing.

---

## 🎯 Core Design Philosophy for Retail POS
FlowPOS Pro is not a casual website; it is an industrial retail workstation operating on tablets, desktops, and mobile terminals under intense daylight or dark warehouse conditions. Every pixel must serve speed, clarity, and cashier confidence.

---

## 📐 The 6 Pillars of UI/UX Pro Max

### 1. Cashier Ergonomics & Touch Targets
* **Minimum Hit Target:** All interactive controls (buttons, input fields, selector chips) must measure at least **44x44px** on desktop and **48x48px** on mobile/tablet touchscreens.
* **Thumb Zone Architecture:** Primary POS checkout triggers must reside in natural thumb-reach zones (bottom or right edge in RTL layouts).
* **Keyboard & Scanner Harmony:** Support auto-focus restoration on the barcode input field after dialog closures to avoid cashier mouse taps.

### 2. High-Contrast & Daylight Legibility (Anti-Washed-Out)
* **Light Mode:** High contrast foregrounds (`text-foreground` / `text-slate-900`) on subtle neutral surfaces. No black text on dark gray backgrounds, and no invisible white-on-light-gray buttons.
* **Dark Mode:** Deep charcoal/slate dark themes (`#0f172a` / `#090d16`) with crisp border definitions (`border-border/60` or `border-white/10`).
* **Status Badges:** Use rich background tints with high-contrast text:
  * Success: `bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`
  * Warning: `bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20`
  * Danger: `bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20`
  * Info/Primary: `bg-primary/15 text-primary border-primary/20`

### 3. Arabic RTL Typography & Metrics Perfection
* **Native RTL Flow:** Flex and Grid containers must respect logical CSS properties (`inset-inline`, `padding-inline`, `margin-inline`, `rtl:`, `ltr:`).
* **Font Scaling:** Numbers, currencies, and barcodes use monospace numerals (`font-mono tracking-tight font-bold`) for instant financial readability.
* **No Truncation Disasters:** Avoid arbitrary fixed-width containers that clip product names or totals. Use `truncate`, `min-w-0`, and adaptive flex wrappers with tooltip fallbacks.

### 4. Tactile Micro-Interactions & Fluid Motion
* **Tactile Feedback:** Buttons should have subtle active compression: `active:scale-[0.98] transition-transform duration-100`.
* **Motion Physics:** Entrances use cubic-bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)`) with durations capped at **150ms - 220ms**. Never introduce sluggish or distracting animations that slow down the cashier.
* **Dynamic Island Synergy:** All visual confirmation alerts harmonize with the in-app Dynamic Island `SmartToast`.

### 5. Anti-AI Slop Standards
* 🚫 **Banned:** Generic AI purple-indigo radial background glows.
* 🚫 **Banned:** Useless decorative widgets or empty dashboard cards that have no operational retail value.
* 🚫 **Banned:** Cluttered icons without semantic meaning. Use clear Lucide icons with consistent stroke weights (1.75 - 2px).
* 🚫 **Banned:** Inconsistent corner radiuses. Adhere strictly to the project scale (`rounded-xl` for inputs/cards, `rounded-2xl` for dialogs/panels).

### 6. Strict Compliance with UI Consistency Lock (UCL)
* **Rule:** While transforming visual design, typography, padding, and colors, **NEVER** alter established button names, key action texts, or the fundamental step sequence of the checkout flow.
