#!/bin/bash
# Optional user-facing preview. Workflow callers own intermediate presentation.
[ "${MEIGEN_AUTO_OPEN:-0}" = "1" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

# Prefer structured results. Retain the old text format for older MCP servers.
SAVED_PATH=$(jq -er '
  .tool_response as $response |
  ($response.structuredContent.savedPath //
    ([$response.content[]? | select(.type == "text") | .text |
      split("\n")[] | select(test("^-? ?Saved to: ")) |
      sub("^-? ?Saved to: "; "")][0]) // empty) |
  select(type == "string" and length > 0)
' 2>/dev/null) || exit 0

# Server output paths are absolute. Quoting preserves spaces and shell characters.
case "$SAVED_PATH" in /*) ;; *) exit 0 ;; esac
[ -f "$SAVED_PATH" ] || exit 0
if [ "$(uname)" = "Darwin" ]; then
  open "$SAVED_PATH" >/dev/null 2>&1 &
fi
exit 0
