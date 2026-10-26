---
name: antigravity-serena-token-engine
description: Unified token optimization and surgical symbolic code editing skill combining the Antigravity Token Efficiency Protocol and Serena LSP symbolic toolkit. Use whenever writing, editing, debugging, refactoring, or generating developer directives for codebases (especially Flow POS Pro, React/TypeScript, Capacitor, Dexie, and Supabase) to prevent full-repository tree scanning, enforce symbol-level retrieval and surgical edits, and cut token/credit consumption by 60% to 80%.
---
# Antigravity Serena Token Engine (SKILL.md)

An executive engineering and token-optimization skill that merges the **Antigravity Token Efficiency Protocol** (adapted from `claude-token-efficient` & `Antigravity Protocol 2.0`) with the **Serena LSP Symbolic Editing Toolkit** (`oraios/serena`). It eliminates cold-start repository scanning, replaces full-file rewrites with surgical symbol-level mutations, and enforces terse, high-signal execution tailored for **Flow POS Pro** (React, TypeScript, Capacitor Android, Dexie/IndexedDB, and Supabase).

## When to Use

- Modifying, debugging, or refactoring specific functions, components, or modules without scanning the entire application tree.
- Working in Google Antigravity (`.agent/skills/antigravity-serena-token-engine/SKILL.md`) or Claude Code (`.claude/skills/antigravity-serena-token-engine/SKILL.md`) where credit and context window conservation is critical.
- Issuing or executing technical directives for **Flow POS Pro** where untouched code, offline-first Dexie stores, and USD accounting formulas must remain strictly isolated.
- Navigating large files (over 150-200 lines) where loading or rewriting the whole file wastes tokens.

## Core Rules & Execution Protocol

### Phase 1: Intent Rectification and Zero-Scan Targeting

1. **NO REPO-WIDE SCANNING**: Never run recursive directory scans (`find .`, `ls -R`, `tree`) or broad repository-wide searches when the user specifies target files, components, or modules.
2. **DIRECT PATH ACCESS**: Go directly to the explicit file path provided (e.g., `src/services/...`, `src/components/...`). If a symbol or component name is given without a path, execute **one** targeted symbol lookup (`find_symbol`) or exact file search (`find_file` / `rg -l "ExactName"`) and open only the matching file.
3. **STOP ON AMBIGUITY**: If a request is ambiguous or risks touching unmentioned architecture layers, stop immediately before scanning files and ask the user concise, concrete clarifying options.
4. **STRICT LAYER ISOLATION (Flow POS Pro Guardrail)**:
   - Frontend UI (HyperOS components) and local Dexie/IndexedDB tasks must never inspect or touch backend Supabase SQL migrations, RLS policies, or Edge Functions unless explicitly mandated.
   - Never alter USD primary currency calculations, profit formulas, or historical invoice records unless explicitly instructed.

### Phase 2: Serena Symbolic Retrieval (Read Outline Before Body)

1. **OUTLINE FIRST (`get_symbols_overview`)**: When entering any target file over 150 lines, invoke `get_symbols_overview` first to inspect classes, functions, hooks, and interfaces without loading implementation bodies into context.
2. **FETCH TARGET SYMBOL ONLY (`find_symbol`)**: Call `find_symbol` with `include_body=true` exclusively for the specific function, React component, hook, or method that requires modification.
3. **SURGICAL IMPACT TRACING (`find_referencing_symbols`)**: Before modifying a shared function signature, Dexie table helper, or state store, call `find_referencing_symbols` to inspect only the exact call sites rather than running text grep across the project.
4. **READ ONCE RULE**: Never read the same file or symbol twice in a single session unless it was modified externally. Skip binary assets, lockfiles (`package-lock.json`, `pnpm-lock.yaml`), build outputs (`dist/`, `android/`), and files over 100KB unless explicitly required.

### Phase 3: Surgical Symbol and Chunk Mutation

1. **ATOMIC SYMBOL REPLACEMENT**: When Serena MCP is active, apply edits using symbolic tools instead of line-number guessing or full-file overwrites:
   - `replace_symbol_body`: Replace only the target function, method, or component body.
   - `insert_after_symbol`: Add a new helper function, type, or hook immediately after an existing symbol.
   - `insert_before_symbol`: Add imports, interfaces, or constants immediately before a target symbol.
2. **MINIMAL CHUNK DIFFS**: When using standard file-editing tools (`edit` / `replace_content`), replace only the exact changed lines with minimal surrounding context (3-5 anchor lines). Never regenerate or output unchanged functions in the same file.
3. **TOOL CALL BUDGET DISCIPLINE**: Complete standard targeted fixes within a maximum of **5 to 8 tool calls** by batching independent read or symbol-lookup calls in parallel in a single turn.
4. **PERSISTENT ARCHITECTURAL MEMORY**: When a critical module path or symbol relationship is confirmed, store a concise 1-line note in `.serena/memories` or project memory so subsequent sessions start warm without re-exploring the repository.

### Phase 4: High-Signal Terse Output Protocol

1. **ZERO CONVERSATIONAL FLUFF**: Never open responses with sycophantic praise ("Great question!", "Sure!", "You're absolutely right!") or close with generic pleasantries ("I hope this helps!").
2. **NO TERMINAL YAPPING**: Never dump full unchanged files or long redundant code blocks into the chat window.
3. **COMPACT EXECUTION REPORT (Arabic Technical Summary)**: After applying an edit or generating a developer directive, output only:
   - **الملف والرمز المستهدف (Target File & Symbol)**: Exact path (`src/...`) and function/component modified.
   - **التعديل الجراحي المنفذ (Surgical Change Summary)**: Concise Arabic explanation of what changed and why.
   - **محاذير الأمان (Safety Verification)**: Confirmation that USD accounting, offline Dexie sync, and untouched symbols remain intact.
   - **أمر التحقق (Build Check)**: Run `npm run build` with zero errors (exit code 0).

## Symbolic Tool Routing Matrix

| Task Objective | Banned High-Token Action (High Credit Burn) | Required Surgical Action (Antigravity + Serena) |
| :--- | :--- | :--- |
| Understand a 1,000-line file | `read_file` on the entire file | Call `get_symbols_overview` on the file path |
| Locate a specific function/hook | Repo-wide `grep` or `find .` | Call `find_symbol` by exact or substring symbol name |
| Check who calls a function | Reading all imported files manually | Call `find_referencing_symbols` on the target symbol |
| Edit a 20-line method in a large file | Rewriting the entire file | Call `replace_symbol_body` or minimal chunk diff |
| Add a new helper function | Reading and rewriting the module | Call `insert_after_symbol` at the anchor function |
| Rename a symbol across files | Multi-file regex search & replace | Call `rename_symbol` via Serena LSP |

## Installation Paths for Your Local Environment

- **For Google Antigravity**: Save this file to `.agent/skills/antigravity-serena-token-engine/SKILL.md` inside your project root (or globally in `~/.gemini/antigravity/skills/antigravity-serena-token-engine/SKILL.md`).
- **For Claude Code**: Save this file to `.claude/skills/antigravity-serena-token-engine/SKILL.md` inside your project root (or globally in `~/.claude/skills/antigravity-serena-token-engine/SKILL.md`).

## Gotchas

- **Bottom-to-top edits without LSP**: When modifying multiple locations in the same file using line-based chunk edits rather than `replace_symbol_body`, always apply edits from bottom to top (highest line number first) or in a single batched call so earlier edits do not shift line numbers.
- **User override rule**: Explicit instructions in the user's current prompt always take precedence. If the user explicitly asks for a full file dump or detailed explanation, honor the request directly.
