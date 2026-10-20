---
name: update-changelog
description: Update CHANGELOG.md with entries derived from git tags and commit history. Use when a version tag exists without a changelog entry, when the user asks to update the changelog or add release notes, or when preparing to tag a new release.
---

# Update Changelog

Keep `CHANGELOG.md` in sync with what actually shipped — one entry per version tag, verified against git history, written in this repo's style.

## When to use

- A git tag exists but has no `CHANGELOG.md` entry
- The user is about to tag a new release and wants the changelog ready
- The user asks to update the changelog or write release notes

## Procedure

### 1. Find which versions are missing

Compare git tags against existing changelog headings:

```bash
git tag --sort=-creatordate
grep -n "^## \[" CHANGELOG.md
```

Every tag without a matching `## [version]` heading needs an entry.

### 2. Collect commits per version range

For each missing version, list the commits between the two tags:

```bash
git log --oneline <previous-tag>..<tag>          # existing tag
git log --oneline <latest-tag>..HEAD             # upcoming release
```

Also check `git status --short` — uncommitted work may still ship with the release.

### 3. Get the dates

Tag dates come from git, the new release uses today:

```bash
git log -1 --format=%ad --date=short <tag>       # tag date
date +%Y-%m-%d                                   # upcoming release
```

### 4. Verify each commit against its actual diff

Never trust commit messages alone — check what really changed:

```bash
git show --stat --format="%h %ad %s" --date=short <commit>
```

Common verification points:

- "add new post" → open the added file's frontmatter for the real `title`
- Multi-purpose commits → check every file touched (a styling commit may also bump dependencies)
- Binary-only commits (`.env.gpg`) → describe as housekeeping, e.g. secret rotation

### 5. Write the entry in repo style

Place newest entry at the top, directly after the header. Follow these rules:

- Heading: `## [version] — YYYY-MM-DD` (em dash, date from step 3)
- Small releases (1–3 trivial commits): plain `- ` bullets, no section headers
- Larger releases: group into `### emoji Section Title` themed sections
- Bold post names and key highlights with `**`
- No trailing periods on bullets
- Housekeeping (secret refresh, dependency bumps) gets plain bullets

Commit prefixes map to sections:

| Prefix | Meaning                                               |
| ------ | ----------------------------------------------------- |
| `fea:` | feature bullet                                        |
| `fix:` | bug fix                                               |
| `enh:` | improvement / polish                                  |
| `oth:` | housekeeping (usually skippable, or one plain bullet) |

### 6. Verify

- `read CHANGELOG.md` — confirm new entries, order, and formatting
- Confirm the working tree is clean apart from `CHANGELOG.md` so the user can commit and tag

## Example

```markdown
## [0.0.13] — 2026-10-20

### 🔎 Sitemap & content discovery

- Add sitemap generation via `@astrojs/sitemap`, referenced from `robots.txt` and
  the page `<head>`
- Prerender blog posts so each post shows up in the sitemap

### ✨ Polish

- Add view transitions (`ClientRouter`)
```

```markdown
## [0.0.12] — 2026-10-19

- New post: **Deno is done**
- Refresh encrypted environment secrets
```

## Notes

- The changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) with repo-specific emoji sections — mirror what's already in the file over any external convention
- If a commit's message and its diff disagree, the diff wins
- Never invent content: every bullet must trace back to a commit you inspected
