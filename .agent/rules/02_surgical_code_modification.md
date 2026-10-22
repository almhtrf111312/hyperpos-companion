# 02 — Surgical Code Modifier (Ponytail Logic)

## 🎯 Core Directive
**Eliminate code regression and context bloating by enforcing strict surgical editing.**
Under no circumstance should an agent rewrite entire multi-hundred-line files when making localized changes. Every edit must be minimal, targeted, and atomic.

---

## 🛠️ Mandatory Editing Principles

### 1. Targeted Editing Over Full-File Rewrite
* **Rule:** Use pinpoint search-and-replace (`edit_file`) or minimal line-targeted replacements.
* **Prohibition:** Never dump 1,000+ lines of code to change a 5-line logic block. This prevents token exhaustion, truncations, and accidental dropping of unrelated features.

### 2. Comment & Documentation Preservation
* **Rule:** Never delete or alter existing Arabic/English comments, JSDoc blocks, or architectural annotations unless the comment is directly obsolete due to the change.
* **Rule:** Preserve existing `console.error`, `logActivity`, and `errorRadar` logging lines. Diagnostic hooks are essential for offline crash investigation.

### 3. Encoding & Character Set Integrity (UTF-8 Strict)
* **Rule:** Always enforce UTF-8 without BOM.
* **Prohibition:** Never introduce mojibake / corrupted Arabic text (e.g. `طھظ… طھط³ط¬ظٹظ„`). Always verify Arabic strings remain human-readable and correct.

### 4. Tree-Shaken & Lean Imports
* **Rule:** Only import what is needed. Do not import heavyweight libraries in hot client-side loops.
* **Rule:** Never statically import Capacitor plugins or Electron modules in code executed uniformly on the web without `Capacitor.isNativePlatform()` guards or dynamic loading.
* **Rule:** Use `import type` for TypeScript types to guarantee zero runtime bloat.

### 5. Atomic Rollbacks on Error
* If an edit introduces a compile error or unexpected behavior, immediately revert the surgical change rather than layering hacks on top of broken code.
* Always run `npm run build` or type checks to verify clean compilation.
