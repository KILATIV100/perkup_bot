---
name: reviewing-documentation
description: >
  Provides documentation audit checklists and quality standards.
  Use when reviewing README files, SKILL.md files, agent definitions,
  copilot-instructions.md, or ARCHITECTURE-FLOW.md for quality and consistency.
---

# Documentation Review Guidance

Audit, improve, and maintain documentation quality across the repository. Search for doc files — don't rely on hardcoded paths.

## Architecture Maintenance

For `ARCHITECTURE-FLOW.md` updates, load `.github/skills/understanding-architecture/SKILL.md` first — it has validation commands and source-of-truth mappings.

## SKILL.md Quality Gates

**Naming rules** (agentskills.io spec):
- ✅ `writing-csharp-code` (lowercase, hyphens, max 64 chars)
- ❌ `WritingCSharpCode` | `writing--csharp` | `-writing-code`

**Required frontmatter**: `name` (must match directory name), `description` (must explain WHAT and WHEN, max 1024 chars)

**Body must include**: goal statement, practical code examples, common mistakes, related skill cross-references.

## .agent.md Quality Gates

**Required frontmatter**: `name`, `description`, `argument-hint`, `tools`, `model`

**Verify**: `handoffs` reference valid agent `name` values from other agent files.

## copilot-instructions.md

Loads on every request — keep it lean. Must have: architecture quick reference, dev commands, agents table, skills table.

## Audit Checklists

### ARCHITECTURE-FLOW.md
- [ ] Mermaid diagrams render without syntax errors
- [ ] State machines match `appState.ts` type definitions
- [ ] SSE events match `Program.cs` Write*Event methods
- [ ] Actions match `AppAction` type union

### README.md
- [ ] Quick start works for new users
- [ ] Commands table is accurate
- [ ] Links to sub-READMEs resolve

### Skills & Agents
- [ ] Valid YAML frontmatter on all files
- [ ] SDK versions in examples match `*.csproj` / `package.json`
- [ ] Cross-references between skills are valid

### Cross-Document Consistency
- [ ] Architecture tables match across all docs
- [ ] Port numbers consistent (5173, 8080)
- [ ] SDK versions match actual dependencies

## Review Output Format

For each document reviewed:

**Document**: `path/to/file.md` — ✅ Good | ⚠️ Needs Improvement | ❌ Broken

**Issues**: numbered list with suggested fixes

**Cross-Reference Issues**: broken links, version mismatches

## Content Quality Rules

All documentation must state **how things work now**, not history or rationale for past changes.

### Must NOT contain
- **Version numbers in prose** — reference `*.csproj` or `package.json` instead. Hardcoded versions go stale silently.
- **Issue/PR tracker links** — these are PR artifacts, not reference docs. Exception: links to external tracking if explicitly requested.
- **Duplicate information** — if a fact is stated in one section, don't restate it in another. Cross-reference instead.
- **Narrative or history** — "we changed X because Y happened" belongs in commit messages, not docs. State the current behavior.
- **"Fallback" or "automatic" language** for mutually exclusive paths — if two modes are mutually exclusive, say so explicitly. Don't imply graceful degradation that doesn't exist.
- **Stale comments** — `// TODO (if added)` when the thing exists, `// backward compat` without explaining what it's compatible with.

### Must contain (for AI agent effectiveness)
- **Non-obvious constraints** — things an AI agent would get wrong by reading only the code (e.g., "consent to Azure ML Services, not Cognitive Services")
- **Mutually exclusive choices** — state which modes exist and that they don't mix
- **Error signatures** — what error an AI agent will see if it does the wrong thing (e.g., `AADSTS65001`, `AADSTS500131`)
- **File-to-concept mapping** — which file controls which behavior, so agents don't search blindly

### Package/SDK version references
- Tables with versions: remove the version column, point to source of truth
- Prose references: say "pre-release" or "beta" without specific version numbers
- If a version matters for API compatibility, state the minimum version and why

## Style Rules

- Code blocks: always include language identifier (` ```typescript ` not ` ``` `)
- Links: relative paths for internal, absolute for external
- Tables: consistent column widths

## Constraints

- ❌ Don't change code (only docs)
- ❌ Don't invent features not in codebase
