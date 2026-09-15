---
description: >-
  Configure MeiGen MCP credentials privately, or set up a local ComfyUI or
  OpenAI-compatible provider for ordinary image generation. Use for /meigen:setup,
  "configure meigen", "add API key", or connection setup requests.
---

# MeiGen Setup

Guide one decision at a time. Never ask the user to paste a token, API key, authenticated curl command, or credential-bearing config into chat. Never read or print existing credential files, parse secrets from user messages, or echo key prefixes. The user enters secrets through their host's private connection settings, a private editor, or their own terminal outside this conversation.

## Choose the connection

The self-hosted Claude marketplace plugin already bundles one local MCP server. Do not add a duplicate server. Other marketplace copies may package different components; inspect their own manifest before prescribing setup. `/meigen:setup` is a Claude Code command, not a command for other MCP hosts.

Public tools such as `search_gallery`, `enhance_prompt`, `get_inspiration`, `list_models`, and `list_skills` work without a key. Five dedicated workflows—Remove Background, Product Detail Images, Marketing Poster, AI Backgrounds, and Upscale—always require MeiGen and purchased credits. ComfyUI and other providers support ordinary `generate_image`; they do not substitute for these five workflows or MeiGen video generation.

For a Skills request, go directly to MeiGen setup. For ordinary image generation, offer MeiGen, the user's ComfyUI installation, or an OpenAI-compatible provider. If a provider is already configured and working, avoid reconfiguration.

## MeiGen credentials

1. Open https://www.meigen.ai/profile/api-keys and create an API key after signing in.
2. For the local npm/plugin connection, the user sets `MEIGEN_API_TOKEN` in the environment that launches the MCP process or in the host's private server `env` settings. A terminal variable will not necessarily reach an already-running desktop app.
3. Alternatively, the user privately edits `~/.config/meigen/config.json` (`%USERPROFILE%\.config\meigen\config.json` on Windows) and sets `meigenApiToken`. Merge only that field; preserve other provider settings. The user restricts file access to their account (`chmod 600` on Unix).
4. Restart or reconnect the local host after changing configuration.

For a remote connection to `https://www.meigen.ai/api/mcp`, use the host's private HTTP header settings with `Authorization: Bearer <your MeiGen API key>`. Do not add this secret to a shared project file. If the host cannot provide this authentication, use the local npm connection instead.

Buying credits: https://www.meigen.ai/profile (mobile: https://www.meigen.ai/m/premium). Skills and MeiGen API-token generation use purchased credits only; daily free credits and Web free attempts cannot be used. `list_skills` supplies current Skill prices. The model-comparison page is for pricing, not checkout.

## ComfyUI for ordinary images

Ask only for a non-secret server URL if it differs from `http://localhost:8188`. The user sets `comfyuiUrl` in the private MeiGen config. Confirm reachability using a bounded request to `/system_stats` only when needed; do not print credentials or a large machine inventory.

Ask for an actual exported ComfyUI API-format workflow file path. Import with `comfyui_workflow(action="import", filePath=..., name=...)`; inspect its detected nodes with `action="view"`. The export UI varies by ComfyUI version; use its current API-format export option. Configure `comfyuiDefaultWorkflow` if desired. Preserve other settings.

## OpenAI-compatible providers for ordinary images

Ask for the non-secret base URL and model ID, using the provider's current documentation. The user privately configures `OPENAI_API_KEY`, optionally `OPENAI_BASE_URL` and `OPENAI_MODEL`, or `openaiApiKey`, `openaiBaseUrl`, and `openaiModel` in the private MeiGen config. Do not solicit an API key or curl example. Do not infer model support from another provider's model names.

## Verify and continue

After the user confirms configuration is saved and the host is reconnected, use `list_skills` or `list_models` to verify that tools are reachable. These public calls do not prove that a paid API key is valid or that sufficient credits exist. Do not run a paid generation merely to test setup; resume only the user's authorized creation request.

For the five dedicated workflows, call the dedicated tool directly, without prompt enhancement or a generic image-generation agent. Preserve its `requestId` and follow `nextAction`; after an interrupted submission call `check_skill` with the original ID before any retry. Missing/invalid-key responses need corrected connection settings, not polling. Explain any remaining error without exposing the secret.
