---
title: "ADR-0003: Dynamic Island In-App Notification System"
date: 2026-10-22
status: "Accepted"
tags:
  - ui
  - notifications
  - smart-toast
  - dynamic-island
---

# ADR-0003: Dynamic Island In-App Notification System

## 📌 Context & Problem Statement
Previously, app notifications were split between Sonner toast banners and Android native system notifications. When cashiers made dozens of sales daily, Android system notifications flooded the device notification shade, appeared blank or delayed, and interrupted cashier workflow.

## 🎯 Decision Drivers
* Instant, tactile visual and auditory feedback on sales.
* Zero spam in mobile OS notification shade during business hours.
* Support for quick cashier actions (Print receipt, Share invoice) directly on the notification.
* Gesture dismissibility (Swipe Up to swallow, Swipe Left/Right to dismiss).

## ✅ Decision Outcome
Chosen option: **Unified In-App Dynamic Island SmartToast with Physics & Freeze Countdown**.

1. **In-App Exclusivity:**
   * Daily sales, debts, settings, and refunds are strictly restricted to in-app rendering (`SmartToast.tsx`). Android system notification bridges are eliminated for routine events.
2. **Physics & Timer Mechanics:**
   * Dynamic dropping droplet -> impact burst with lateral shockwaves -> fluid expansion.
   * Touching/hovering pauses countdown; releasing resumes countdown from exact elapsed fraction.
3. **Embedded Actions:**
   * Print and Share buttons embedded directly within the sale toast card.

### Consequences
* **Positive:**
  * Clean, high-end cashier experience; no system shade spam; zero delay.
* **Tradeoffs:**
  * Toasts only appear when the app is foregrounded (desirable behavior for POS terminals).
