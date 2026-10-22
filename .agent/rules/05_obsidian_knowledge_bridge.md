# 05 — Obsidian & Knowledge-Base Bridge (Architecture Decision Records)

## 🎯 Core Directive
**Document every fundamental architectural decision, database contract, and sync protocol in structured Markdown compatible with Obsidian, Logseq, and MCP knowledge bases.**

---

## 🏛️ Knowledge Base Structure

All architectural knowledge is organized under `.agent/docs/`:
```
.agent/docs/
├── adr/                       # Architecture Decision Records (ADRs)
│   ├── 0001-offline-first-hybrid-architecture.md
│   ├── 0002-usd-base-accounting-and-multi-currency.md
│   └── 0003-dynamic-island-inapp-notifications.md
├── schema/                    # Database & Storage Schemas
│   ├── indexeddb_hyperpos_cache.md
│   └── supabase_tables_and_rls.md
└── api/                       # Internal API & Sync Contracts
    └── sync_queue_operations.md
```

---

## 📝 ADR Creation Standard
Whenever a significant architectural change occurs:
1. Create a new numbered ADR file in `.agent/docs/adr/XXXX-<slug>.md` using `.agent/templates/adr_template.md`.
2. Format content using standard Obsidian-compatible markdown:
   * **Frontmatter:** Title, status, date, deciders, tags.
   * **Wikilinks:** Use `[[ADR-XXXX]]` or standard markdown links for inter-document references.
   * **Mermaid Diagrams:** Use flowcharts and sequence diagrams to illustrate data flows.

---

## 🔄 Obsidian Vault Integration
* The `.agent/docs/` directory is designed to be directly opened as an Obsidian Vault or linked via symlink/submodule to an external team knowledge vault.
* External MCP servers (such as Filesystem or Context MCPs) can query `.agent/docs/` to provide instant architectural context to AI coding agents.
