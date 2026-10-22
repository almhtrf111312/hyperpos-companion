---
name: flowpos-obsidian-sync
description: Obsidian & Knowledge Base Bridge Skill for FlowPOS Pro. Exports architectural decision records (ADRs), database schemas, and sync queue protocols in standard Markdown compatible with Obsidian and external MCP knowledge bases.
---

# FlowPOS Pro Obsidian Sync Skill

This skill formats, validates, and synchronizes architectural knowledge in `.agent/docs/` with Obsidian vaults or external MCP servers.

## When to Run This Skill
* When making significant architectural decisions or database schema migrations.
* When synchronizing project documentation with an external Obsidian vault.
* When documenting API and sync contracts for team onboarding.

## Workflow

### Step 1: Scan Recent Architectural Changes
1. Check git log for changes to:
   - Database schema (`supabase/migrations/`)
   - Sync engine (`src/lib/sync-queue.ts`, `src/lib/cloud/*`)
   - Platform bridges (Capacitor/Electron)

### Step 2: Author or Update ADR
Create a new record in `.agent/docs/adr/XXXX-<slug>.md` using `.agent/templates/adr_template.md`:
* Assign consecutive number.
* Include context, drivers, options, decision, consequences, and Mermaid diagram.
* Ensure Obsidian wikilinks and YAML frontmatter are valid.

### Step 3: Update Index & Project Memory
Link the new ADR in `.agent/PROJECT_MEMORY.md` and verify all internal markdown links resolve cleanly.
