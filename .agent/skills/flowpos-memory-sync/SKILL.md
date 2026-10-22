---
name: flowpos-memory-sync
description: Persistent Project Memory Sync Skill for FlowPOS Pro. Updates .agent/PROJECT_MEMORY.md with task summaries, modified files, sync status, and roadmap milestones at the end of every workflow.
---

# FlowPOS Pro Memory Sync Skill

This skill synchronizes the agent's work with `.agent/PROJECT_MEMORY.md` to ensure seamless context handoff between prompts, sessions, and agents.

## When to Run This Skill
* At the end of every feature development, bug fix, or refactor task.
* When technical debt, bugs, or architectural decisions are identified.
* Whenever version or dependencies are updated.

## Workflow

### Step 1: Gather Session Metadata
1. Retrieve git status / git diff summary:
   - Modified file paths.
   - Commit hash or change summary.
2. Check if new storage keys, sync queue types, or database tables were added.

### Step 2: Update `.agent/PROJECT_MEMORY.md`
Edit `.agent/PROJECT_MEMORY.md`:
* Append entry under **Recent Implementations & Changelog Log**.
* Update **Current Version** or **Last Updated** date.
* Add any new technical debt or resolved edge cases under **Known Technical Debt & Edge Cases**.
* Check off completed milestones and append new ones under **Next Logical Milestones**.

### Step 3: Verify Integrity
Confirm that the memory file remains clean markdown with no broken links or corrupt character encodings.
