---
title: "ADR-0002: USD Base Accounting and Multi-Currency Engine"
date: 2026-10-22
status: "Accepted"
tags:
  - finance
  - multi-currency
  - accounting
---

# ADR-0002: USD Base Accounting and Multi-Currency Engine

## 📌 Context & Problem Statement
In fluctuating currency markets (e.g., Iraq, Lebanon, Turkey), retail stores accept payments in local currencies (IQD, TRY, LBP) while wholesale purchasing is conducted in US Dollars (USD). Storing ledger transactions in volatile local currencies leads to inaccurate financial statements and capital distortion.

## 🎯 Decision Drivers
* Stable, non-drifting profit and loss calculations.
* Partner equity and capital tracking immune to local currency devaluations.
* Flexible cashier pricing and dual-currency checkout receipts.

## ✅ Decision Outcome
Chosen option: **USD Invariant Accounting Base with Dynamic Conversion Presentation**.

1. **Accounting Base:**
   * All cost prices, stored profits, partner balances, and inventory valuations are recorded in `USD`.
2. **Presentation & Checkout:**
   * Local currency prices are calculated via exchange rates: $\text{Price}_{\text{Local}} = \text{Price}_{\text{USD}} \times \text{Rate}$.
   * At invoice creation, the exact exchange rate is snapshotted into the invoice record (`exchange_rate`, `currency_symbol`).
3. **Refund Integrity:**
   * Refunds calculate based on the snapshotted historical rate to prevent currency arbitrage during returns.

4. **Canonical Currency Symbol Presentation:**
   * Known legacy Arabic symbols are presented as their ISO currency codes only when the symbol matches the resolved currency identity.
   * Custom store symbols and international glyphs remain unchanged unless they exactly match a known legacy symbol for that currency.
   * Legacy settings are normalized in memory for display; no automatic storage migration or change to the USD accounting base, stored amounts, or historical exchange rates is performed.
5. **Explicit Currency Activation and Display Mode:**
   * USD remains enabled as the accounting base. A non-USD currency is available as metadata but is included in active currency lists and converted-currency cards only when explicitly enabled or selected as the store's primary currency; an exchange rate or legacy metadata alone does not activate it.
   * Each currency's presentation mode is stored in the existing unified store settings as `symbol`, `name`, or `both`. The selected mode affects display formatting, reports, PDF/Excel metadata, print, and share output only; it does not change monetary values or historical invoice snapshots.
   * Existing local/cloud settings carry the display mode through the current `sync_settings` payload and offline settings queue. No schema, SQL/RPC, or database migration is introduced.

### Consequences
* **Positive:**
  * Clean balance sheets; capital and profit remain mathematically accurate over years.
* **Tradeoffs:**
  * Requires strict developer vigilance: NEVER hardcode `$` in UI, and never store sales purely in local currency without base USD.
