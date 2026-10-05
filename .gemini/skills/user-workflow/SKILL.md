---
name: user-workflow
description: Strict guidelines, coding standards, workflow preferences, and interaction style for this user. ALWAYS follow these instructions during development.
---

# User Workflow & Preferences

This skill defines the strict interaction style, coding standards, and workflow preferences expected by the user. Adherence to these rules is mandatory for every task.

## 1. Execution & Workflow Rules
- **Direct Execution (No Testing/Experiments)**: NEVER run experiments, side tests, or trial scripts. Proceed directly to implementing the solution in the actual codebase.
- **Direct GitHub Push**: ALWAYS commit and push changes directly to the GitHub repository (`main` or specified branch) once the implementation is complete. Do not ask for permission to push unless explicitly instructed otherwise.
- **Strict Scope Boundaries**: Stick EXACTLY to the files and scope specified by the user. 
- **Frontend vs. Backend**: Unless explicitly requested, restrict modifications entirely to the Frontend (React, TypeScript, UI). NEVER alter backend logic, SQL queries, or database schemas without explicit permission.

## 2. Interaction & Communication
- **Arabic Summaries**: ALWAYS provide a detailed, accurate, and structured summary in **Arabic** at the end of the task. The summary must clearly outline the implemented modifications, the files touched, and the rationale behind the fixes.
- **Professional & Direct Tone**: Keep interactions professional, concise, and direct. Avoid unnecessary conversational filler.
- **No Unsolicited Advice**: Focus strictly on the task at hand. Do not provide unsolicited refactoring suggestions or unrelated optimizations unless they directly impact the requested fix.

## 3. Code Cleanliness & Best Practices
- **Strict Cleanliness**: Keep the codebase clean. Remove any sensitive files (e.g., `.keystore`, `.jks`), redundant logs (`build_log.txt`), or unused/orphan components from the repository.
- **No Frivolous UI Elements**: Do not add unnecessary popups, toasts, or notifications (e.g., "Tab switched"). Retain UI notifications ONLY for actual state-changing operations (e.g., "Invoice saved successfully", "Error adding expense").
- **Preserve Logic & Math**: Never alter established mathematical formulas or core business logic unless explicitly identified as the root cause of a bug.
- **Data Integrity & Offline-First**: When dealing with data, always respect the offline-first architecture. Ensure robust offline fallbacks (e.g., `saveToLocalAndQueue`) and handle data sync race conditions securely. Never let a network failure result in data loss.

## 4. Verification & Commit Standards
- **Precise Targeting**: When editing files, ensure text replacements are highly precise. Avoid targeting Arabic comments in search/replace blocks to prevent encoding mismatch errors.
- **Commit Messages**: Write clear, descriptive, and professional commit messages in English that accurately reflect the fixes made.
