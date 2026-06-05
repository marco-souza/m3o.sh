---
name: learning
description: >
  Capture key decisions, pivots, and constraints discovered during work sessions.
  Use after architectural changes, before starting new PRDs when context has evolved,
  or when the user says "document this decision" or "remember this".
---

# Learning — Document Decisions & Architectural Pivots

> Capture key decisions, pivots, and constraints discovered during work sessions. Prevent re-asking solved questions.

## When to Use

- After a `grill-me` session that changed the architecture
- When the user says "document this decision" or "remember this"
- Before starting a new PRD when prior context has evolved
- To pass knowledge to future sessions or subagents

## When NOT to Use

- For temporary notes (use TODO.md or chat context)
- For code documentation (use inline comments)
- For specs that guide implementation (use PRD.md or SPEC.md)

## Format

Create a markdown file in the project's `.agents/learned/` directory:

```
.agents/learned/
  <topic-name>.md
```

Each file should have:

```markdown
# Learned: <Topic>

**Date:** YYYY-MM-DD
**Context:** <brief context of what we were building>
**Status:** Active | Deprecated | Superseded by <link>

## Decisions

| Decision | Rationale | Counter-arguments rejected |
| -------- | --------- | -------------------------- |
| ...      | ...       | ...                        |

## Constraints Discovered

- <constraint and where it came from>

## Open Questions (if any)

- [ ] <question>

## Related

- <link to PRD, SPEC, or rule files>
```

## Rules

- **One file per topic.** Don't dump everything into one file.
- **Date everything.** Architecture decays; dates help future readers know if it's stale.
- **Mark status clearly.** If a decision was later reversed, say "Superseded by X" and link.
- **Include rejected alternatives.** This is the most valuable part — it prevents re-asking.
- **Keep it short.** Max 200 lines. If it's longer, split into multiple topic files.
- **Reference, don't duplicate.** Link to PRDs/SPECs for full requirements; this file is for _why_ we chose what we chose.
