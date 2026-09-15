# Providers and configuration

| Workflow | Provider | Billing |
|---|---|---|
| Remove Background, Product Detail Images, Marketing Poster, AI Backgrounds, Upscale | MeiGen only | Purchased MeiGen credits; no daily free credits or Web free attempts |
| Video generation | MeiGen only | Purchased MeiGen credits |
| Ordinary image generation | MeiGen, configured OpenAI-compatible endpoint, or ComfyUI | MeiGen purchased credits, provider billing, or the user's hardware/server costs |
| Gallery search, inspiration, model/Skill discovery | MeiGen public services | No generation charge |

Use `list_skills` for live Skill prices; use `list_models` for model capabilities and https://www.meigen.ai/model-comparison for other MeiGen generation prices. Never promise a fixed model, quality default, latency, or offline operation for cloud features.

## Private credentials

Create a MeiGen key in a desktop browser at https://www.meigen.ai/profile/api-keys. The user privately sets `MEIGEN_API_TOKEN` in the environment of the MCP process, or `meigenApiToken` in `~/.config/meigen/config.json`. Do not ask for credentials, authenticated curl, or the file's contents in chat. Setting variables in a terminal does not automatically update an already-running desktop host. Reconnect after changes.

For BYOK ordinary image generation, the corresponding environment variables are `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`; private config fields are `openaiApiKey`, `openaiBaseUrl`, and `openaiModel`. Use that provider's actual endpoint/model documentation. Merge only intended fields and preserve other settings. On Unix the user should restrict private config access with `chmod 600`; do not claim the program applies these permissions automatically.

For ComfyUI, configure `COMFYUI_URL` or `comfyuiUrl` (default `http://localhost:8188`) and import an actual API-format workflow with `comfyui_workflow`. Optional `comfyuiDefaultWorkflow` selects the workflow. A configured ComfyUI server can be local or remote; references are sent to that server. Run one generation at a time.

Multiple providers can coexist. Ordinary image provider auto-selection is MeiGen, then an imported ComfyUI workflow, then OpenAI-compatible. This order never redirects a dedicated Skill to BYOK.

For remote HTTP MCP, configure `Authorization: Bearer <MeiGen API key>` privately for `https://www.meigen.ai/api/mcp`. Remote MCP does not include local `enhance_prompt`, `manage_preferences`, or `comfyui_workflow`. It cannot read a file on the user's machine merely because a path was supplied.
