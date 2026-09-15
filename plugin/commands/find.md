---
description: >-
  Quick gallery search. Use when user runs /meigen:find with keywords
  to browse inspiration.
argument-hint: <keywords>
---

# Quick Find

Search the curated gallery for inspiration. Show visual results immediately.

## Instructions

1. Call `mcp__meigen__search_gallery` with query: `$ARGUMENTS`
   - If no arguments provided, call with no query to get trending picks
   - Preserve a caller-specified limit; otherwise use limit: 6
2. Display results as a compact list:
   - Number, preview image (markdown), one-line prompt excerpt, category
3. Return results to the caller. Offer a follow-up only when this is direct user-facing exploration, not an intermediate workflow step.

If the user picks a number, call `mcp__meigen__get_inspiration` with that entry's ID to show the full prompt and images.

Keep output visual and scannable. No long explanations.
