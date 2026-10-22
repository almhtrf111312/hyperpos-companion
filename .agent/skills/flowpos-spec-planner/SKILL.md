---
name: flowpos-spec-planner
description: Spec-Driven Planning Engine for FlowPOS Pro. Generates comprehensive technical specifications (spec.md) covering offline DB, Supabase sync, currency formulas, and rollout plans before any production code is touched.
---

# FlowPOS Pro Spec Planner Skill

This skill enforces the **Spec-Driven Planning Protocol** across FlowPOS Pro. It prevents premature code editing and guarantees architectural alignment.

## When to Run This Skill
* At the beginning of any non-trivial user feature request.
* Before implementing multi-file refactors or new store/cloud integrations.
* Whenever schema changes (IndexedDB / Supabase) or sync queue extensions are needed.

## Workflow

### Step 1: Requirements & Architecture Discovery
1. Analyze user prompt and map required changes to the 3-tier architecture:
   - **Presentation:** Pages (`src/pages/*`), POS Components (`src/components/pos/*`).
   - **Local State & Offline Queue:** Local stores (`src/lib/*-store.ts`), `sync-queue.ts`, `indexeddb-cache.ts`.
   - **Cloud Sync & Supabase:** Cloud modules (`src/lib/cloud/*`), RPCs, Supabase client.
2. Confirm the target domain invariants (Base currency = USD, frozen modules untouchable).

### Step 2: Spec Authoring
Create a specification markdown file in `.agent/specs/` following `.agent/templates/spec_template.md`.
Include:
- System impact diagram (Mermaid).
- Offline-first failure modes and mitigation.
- Exact file paths to be touched.
- Rollout stages.

### Step 3: Present Spec & Await User Confirmation
Render the spec clearly in the chat or as an artifact.
Ask the user for explicit confirmation before touching any source code.
