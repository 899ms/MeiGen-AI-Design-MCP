<h1 align="center">
  MeiGen AI Design MCP <a href="https://github.com/punkpeye/awesome-mcp-servers"><img src="https://awesome.re/mentioned-badge.svg" alt="Mentioned in Awesome MCP Servers"></a> <a href="https://github.com/wshobson/agents/tree/main/plugins/meigen-ai-design"><img src="https://img.shields.io/badge/wshobson%2Fagents-Featured-blue?style=flat&logo=github" alt="Featured in wshobson/agents"></a>
</h1>

<p align="center">
  <strong>开源 MCP 服务器 — 把 AI 图像和视频生成原生接入到你的 AI 编程工具</strong><br><sub>支持主流模型(GPT Image 2 · Nanobanana 2 · Seedream 5.0 · Midjourney V8.1 · Flux 2 Klein · Grok Imagine · Seedance 2.0 · Veo 3.1 · Grok Video · Agnes Video · 本地 ComfyUI),内置 1,446 条精选提示词,支持并行子 Agent 编排和独立 CLI 模式。可用于 Claude Code、Cursor、Codex、Windsurf、Roo Code、OpenClaw、Hermes Agent 及任意 MCP 兼容客户端。</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/meigen"><img src="https://img.shields.io/npm/v/meigen?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/meigen"><img src="https://img.shields.io/npm/dm/meigen?style=flat-square&color=green" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Type-MCP_Server-blue?style=flat-square" alt="MCP Server">
  <img src="https://img.shields.io/badge/Local-ComfyUI-green?style=flat-square" alt="ComfyUI Support">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="MIT"></a>
  <a href="https://discord.gg/uX6rnersUx"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> &bull;
  <a href="#skills">五项 Skills</a> &bull;
  <a href="SKILLS_API.md">HTTP API</a> &bull;
  <a href="#upgrading">升级 2.0</a> &bull;
  <a href="#实际效果">演示</a> &bull;
  <a href="#功能一览">功能</a> &bull;
  <a href="#生成后端">后端</a> &bull;
  <a href="#快捷命令">命令</a>
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

---

> **2.0.1 更新：** `generate_video` 支持多段参考视频与参考音频（`referenceVideos` / `referenceAudios`，本地 `.mp4/.mov/.wav/.mp3` 文件自动上传），各模型上限以 `list_models` 为准。
>
> **2.0.0 更新：** 五项电商/图片 Skills、原图增强、上传检查、任务恢复，以及 Codex 安装指引。[开始使用](#skills) · [老用户升级](#upgrading) · [HTTP API](SKILLS_API.md)

## 这是什么？

一个帮助 AI 助手制作图片、视频和电商素材的 MCP 服务。可连接 **远程服务（14 个工具）**，或安装 **本地 npm 服务（17 个工具）**。支持 **Claude Code**、**Cursor**、**Codex**、**Windsurf**、**Roo Code**、**OpenClaw**、**Hermes Agent** 等兼容 MCP 的客户端。

**2.0.0** 新增五项 Skills：**抠图、商品详情图（Product Detail Images）、营销海报（Marketing Poster）、AI 背景（AI Backgrounds）和图片增强（Upscale）**。它们在 MeiGen 云端运行，需要 MeiGen API Key 和购买积分。本地服务还支持使用 OpenAI 兼容 API 或 ComfyUI 进行普通生图；这两种后端不运行上述五项 Skills。

- 本地普通生图支持三种后端：**MeiGen 云端**、**OpenAI 兼容 API**、**本地 ComfyUI**。当前能力以 `list_models` 为准。
- 内置 1,446 条精选提示词(来自 [nanobanana-trending-prompts](https://github.com/jau123/nanobanana-trending-prompts))+ 风格感知的提示词增强
- 可作为上层工作流中的图片／视频步骤，创意助手与子 Agent 可选；独立 CLI 也适用于 shell 脚本和 CI

---

## 实际效果

<p align="center">
  <a href="https://youtu.be/JQ3DZ1DXqvs">
    <img src="https://img.youtube.com/vi/JQ3DZ1DXqvs/maxresdefault.jpg" alt="观看演示" width="400">
  </a>
  <br>
  <b><a href="https://youtu.be/JQ3DZ1DXqvs">▶ 在 YouTube 观看演示</a></b>
</p>

### 产品图 — 4 个方向并行生成

> *"帮这瓶香水做 4 张产品展示图，其中一张要有模特。"*

**过程** — AI 自动上传参考图、规划 4 个创意方向、撰写专业提示词：

<p align="center">
  <img src="assets/demo-process-zh.jpg" alt="并行生成过程" width="700">
</p>

**结果** — 不到 2 分钟，4 个方向全部完成：

<p align="center">
  <img src="assets/demo-result-zh.jpg" alt="生成结果" width="700">
</p>

**生成的图片：**

<p align="center">
  <img src="assets/sample-luxury.jpg" alt="奢华静物" width="24%">
  <img src="assets/sample-model.jpg" alt="优雅模特" width="24%">
  <img src="assets/sample-botanicals.jpg" alt="梦幻花境" width="24%">
  <img src="assets/sample-minimal.jpg" alt="极简光影" width="24%">
</p>

---

## 快速开始

<a id="install-with-ai"></a>

### 让 AI 助手帮你安装

把下面整段复制给 **Codex、Claude Code、Cursor，或其他能够配置 MCP 服务的 AI 助手**。它可以完成连接配置，并引导你设置凭据。ChatGPT 网页端请看[单独的接入说明](#chatgpt-web)。

```text
请为我当前使用的 AI 客户端安装 MeiGen MCP，参考官方安装指南：
https://github.com/jau123/MeiGen-AI-Design-MCP/blob/main/README.zh-CN.md

先识别当前客户端，检查已有 MCP 配置，不要输出凭据。保留其他服务，
如果已有 MeiGen 连接就复用该条目。
优先使用 Streamable HTTP：https://www.meigen.ai/api/mcp。
Codex 可使用 codex mcp add meigen --url https://www.meigen.ai/api/mcp，
仅在本地已设置该环境变量时，添加 bearer_token_env_var = "MEIGEN_API_TOKEN"；
否则先不配置认证。
如果我需要自动处理本地图片、ComfyUI 或本地专属工具，改用 stdio 命令
npx -y meigen@2.0.1；配置前确认 npm 上存在这个确切版本，不存在就说明。
请引导我在本地凭据设置或启动环境中填写 MeiGen Key，不要让我发到聊天里。
没有 Key 也可以先验证公开查询。
重新加载或连接后，检查实际工具列表，调用 list_skills 验证。
如果你无法修改配置或重新连接，请给出准确的手动步骤，并说明哪些尚未验证。
如果没有 list_skills，请明确指出。
安装验证期间不要上传图片、生成内容或消耗积分。
```

手动安装可直接跳到 [Codex / ChatGPT 桌面端](#codex)、[ChatGPT 网页端](#chatgpt-web)，或下方对应客户端的说明。

### 1. 准备账号

无需 Key 即可浏览灵感、查看模型或 Skill 价格。通过 MeiGen 生成图片前：

1. 在桌面浏览器打开 [API Keys](https://www.meigen.ai/profile/api-keys)，登录后创建以 `meigen_sk_` 开头的 Key；移动网站目前会将此页面重定向。
2. 打开同一账号的[个人主页](https://www.meigen.ai/profile)，点击 **Top Up / 充值**购买积分；手机端使用[会员与积分页](https://www.meigen.ai/m/premium)。API 生成不消耗每日免费积分；五项 Skills 均没有免费次数，包括第一张抠图。当前 Skill 价格可通过 `list_skills` 查看。
3. 将 Key 填入 MCP 宿主的连接设置，不要粘贴到聊天消息或共享配置文件中。

### 2. 选择一种连接方式

| | 远程 MCP — 推荐 | 本地 npm MCP 2.0.1 |
|---|---|---|
| 连接 | Streamable HTTP：`https://www.meigen.ai/api/mcp` | Node.js 进程，通过 stdio 通信 |
| 工具 | 14 项：MeiGen 生成、画廊与五项 Skills | 同样的 14 项，另加提示词增强、偏好管理和 ComfyUI 管理 |
| 参考图 | 公开图片链接、已有 MeiGen URL，或宿主实际能读取的附件字节 | 自动准备本地文件和公开图片链接 |
| 本地能力 | 返回结果 URL，由宿主负责预览/下载 | 普通生成可保存文件；另有 CLI、离线提示词库和本地 ComfyUI |
| 插件扩展 | 单独连接 MCP 不安装快捷命令、Agent、输出风格或 Hook | 安装 Claude Code 插件后提供这些扩展；裸 npm 连接也不包含 |
| 更新 | 后端部署后生效；宿主缓存工具时需刷新/重连 | 本地工具变更需要发布 npm 包并更新客户端 |

同一宿主选择一种连接即可，避免出现重复工具。两种入口使用同一 MeiGen 账号与购买积分。

按客户端查看安装：[远程通用](#remote-mcp) · [Codex](#codex) · [Claude Code](#claude-code) · [Cursor / VS Code / Windsurf / Roo](#other-clients) · [OpenClaw](#openclaw) · [ChatGPT 网页端](#chatgpt-web)。

<a id="skills"></a>

### 3. 试用第一项 Skill

连接后，先说：**“列出可用的 Skills 和当前价格。”** 这不会生成图片或消耗生成积分。然后提供所需素材，直接描述目标：

| Skill / 工具 | 示例请求 | 必需 | 可选 | 产出与计费 |
|---|---|---|---|---|
| 抠图 — `remove_background` | “把这张图的背景去掉，给我透明 PNG。” | 一张原图 | 不需要创意说明 | 一张抠图；首次请求即计费 |
| 商品详情图 — `generate_product_detail_images` | “用这张商品图做主图、细节图和场景图。” | 一张商品图；明确数量/模块 | 商品名、卖点、文案、Logo、模特图、最多两张补充商品图、语言和电商平台 | 1–6 张；每个模块按一张计费 |
| 营销海报 — `generate_marketing_poster` | “为周末咖啡品鉴活动做一张海报。” | 品牌、活动、促销或主题 | 展示文案、Logo、最多三张商品图、一张风格参考图、语言和风格 | 一张海报；图片素材不是必需项 |
| AI 背景 — `generate_ai_background` | “把这个商品放在阳光照射的石台上。” | 一张商品图；自定义模式需描述场景 | 白底/智能/自定义模式、比例和质量 | 一张更换背景的商品图；不是透明抠图 |
| 图片增强 — `upscale_image` | “把这张商品原图变清晰，尽量保持原样。” | 一张原始静态 PNG/JPEG/WebP 图片 | 默认 crisp 保真；creative 会重建细节，需接受变化 | 一张增强图片；不开放视频增强 |

助手会选择工具、准备图片、查询状态并展示预览/下载链接。你不需要编写提示词、UUID 或 API 参数；仅在缺少必要信息时补充即可。已明确数量、模块或质量的请求就是对该范围的确认，无需重复确认。

**商品详情图批次：** 总共选择 1–6 个模块。预设包括主图（`hero`）、细节（`detail`）、场景（`scene`）、材质工艺（`material`）、使用方式（`usage`）和品牌故事（`brand`），也支持自定义模块。MCP 会要求助手显式传入模块，避免漏参数时多生成图片；你只需说要几张，未指定模块时由助手选择。直接使用 HTTP API 时，省略模块仍默认三张（主图、细节图和场景图）。批次数量未明确前，助手应根据实时单价和目标张数计算费用并确认范围。

**文案与质量：** 有固定文案时说明需要保留原文，否则服务可以根据简述拟写文案；同时说明图片中文字的语言。商品详情图和海报默认 Fast，Pro 费用更高。AI 背景默认智能/Fast；白底模式使用固定规格，不采用比例和质量参数。当前选项与价格以 `list_skills` 为准。

**海报参数：** `autoCopy: true` 时 `content` 是简述；`autoCopy: false` 时它是需要保留的可视原文（所选语言仍可能翻译）。风格、排版和设计指令应放进 `extraNotes` 或 `customStyle`，不要混入需逐字展示的 `content`。`extraNotes` 也可包含已核实事实或明确指定的补充展示文案，但其中的设计指令不是要逐字印在图片上的文字。`styleId` 填目录中的 ID 而非显示名称；两种文字风格都不填时为 Auto，非空 `customStyle` 优先于 `styleId`。`styleImage` 是主要视觉风格依据，文字风格只作兼容补充，不复制参考图中的商品、文案或布局；Logo 和商品图分别用于保留标识与商品身份。

**输出与耗时：** 当前商详和海报的 Fast/Pro 都使用 2K 规格，质量档位不等于分辨率；实际像素受比例和供应商输出影响。以 `list_skills` 当前规格和价格为准，不要传工具未提供的 `resolution`。完成时间受排队、规划、供应商和图片数量影响，不承诺固定秒数；查询间隔与 HTTP 超时也不是预计完成时间。

**有效 MCP 调用示例：** 下面是一条已明确活动文案和时间的示例请求；其中 `content` 是可视原文，`extraNotes` 是排版和保留信息的要求，不作为额外印刷文字。可作为 `client.callTool(...)` 的参数。首次选择时可先用 `list_skills({skill: "brand-poster"})` 查看实时选项和费用。它会生成一张付费海报，无需图片；真实任务由调用方生成并保存 UUID，恢复沿用原 ID，不能反复执行示例来盲目重试。

```json
{
  "name": "generate_marketing_poster",
  "arguments": {
    "requestId": "8f729f7e-934e-4e2c-bae3-bf23a782f964",
    "brand": "Coffee tasting",
    "content": "Coffee tasting\nSaturday, 10:00–12:00",
    "autoCopy": false,
    "extraNotes": "Keep the supplied time. Use a clear headline and a small schedule block.",
    "styleId": "minimalist",
    "language": "en",
    "ratio": "4:5",
    "quality": "low"
  }
}
```

**图片：** 本地 npm 服务可直接接收真实文件路径或公开 HTTPS 图片直链。远程 MCP 由助手先通过 `upload_skill_image` 准备外部图片链接或可读取的附件字节，再把返回的 `imageUrl` 交给 Skill。已有 `images.meigen.ai`、`images.meigen.art` 或 `pbs.twimg.com` HTTPS URL 可直接使用。`upload_skill_image` 和 `/api/skills/upload` 要求购买积分余额大于零，本地与远程 MCP 连接均适用；上传不会开始生成或消耗生成积分。宿主无法读取附件时，请提供图片直链或使用本地 npm 服务。

本地预处理接受最多 32 MiB 的源文件，将参考图处理到最长边 4096px、8 MiB 以内，并保留 PNG/WebP 透明通道。远程上传接受最多 8 MiB 的公开 HTTPS 图片，或解码后最多 3 MiB 的真实 base64 图片字节。不支持私网、重定向、需登录或仅 IPv6 的来源。这些是**参考图限制**，不是生成结果的规格。

**Upscale 使用原图：** 直接把原始本地文件或公开 HTTPS 原图链接交给 `upscale_image`，不要先做普通参考图缩放。读取到附件字节时，`upload_skill_image` 应指定 `purpose: "upscale"`。源文件或外链最多 64 MiB / 6400 万像素，base64 解码后最多 3 MiB，只支持静态 JPEG/PNG/WebP。本地上传完整解码、修正方向、移除元数据并保留透明和尺寸，编码后须小于 9,500,000 字节；仍过大时改用公开原图链接。

最长边超过 4096px 或总像素超过 1600 万时，服务先返回 `upscale_resize_required`，不开始生成或扣费。助手应说明缩小输入可能导致结果小于原图、提升有限；用户接受后才设置 `allowDownscale: true`，并生成新的 `requestId`。两种 MCP 首次调用也必须携带 `confirmedCredits`，取自 `list_skills` 的实时报价且符合用户或上层工作流已接受的预算；这是派发前复核，不是事务级消费硬上限。收到 `price_changed` 时同样先确认新报价，再用新 ID 和已接受的 `confirmedCredits` 提交。选择 creative 前说明细节可能改变。

**直接 HTTP API：** 不使用 MCP 的开发者请看[五项 Skills API 完整指南](SKILLS_API.md)，包含上传、运行与恢复示例。能力和实时价格来自 `GET /api/skills`。

<a id="remote-mcp"></a>

### 远程 MCP 端点（免安装，推荐）

在宿主的 MCP 设置中选择 **Streamable HTTP**，填写 `https://www.meigen.ai/api/mcp`，并添加请求头 `Authorization: Bearer YOUR_MEIGEN_API_KEY`。各宿主的设置页面可能不同。Claude Code 也支持：

```bash
# 先在当前终端环境中设置 MEIGEN_API_TOKEN。
claude mcp add --transport http meigen https://www.meigen.ai/api/mcp \
  --header "Authorization: Bearer $MEIGEN_API_TOKEN"
```

远程端点采用[无状态 Streamable HTTP](https://blog.modelcontextprotocol.io/posts/2026-07-28/)，支持 2026-07-28 协议及兼容的 2025 客户端。**无状态指不依赖持久的 MCP 会话。** 已受理的生成任务和计费记录仍保存在服务端，因此对话中断后可以恢复查询。

无需安装 npm，也无需启动本地服务进程。远程工具变更需要**部署后端**，不需要发布 npm 包；客户端可能需要重新加载工具列表。远程生成仍需联网。本地工具或文件处理逻辑变更时，仍然需要更新 npm 包。

<a id="codex"></a>

### Codex / ChatGPT 桌面端（本地 Codex 主机）

适用于 **Codex CLI、Codex IDE 扩展，以及使用本地 Codex 主机的桌面应用**。这些客户端共享同一主机上的 MCP 配置。ChatGPT 网页端使用[另一套接入方式](#chatgpt-web)。参见 [Codex 官方 MCP 指南](https://developers.openai.com/codex/mcp)。

**远程连接——使用 MeiGen 云端与 Skills 时推荐：**

```bash
codex mcp add meigen --url https://www.meigen.ai/api/mcp \
  --bearer-token-env-var MEIGEN_API_TOKEN
```

下面是等效配置，并加入了适合 Skills 的超时设置。合并到 `~/.codex/config.toml`；如果已执行上面的命令，修改已有的 `meigen` 表，不要重复添加。保留其他服务配置。

```toml
[mcp_servers.meigen]
url = "https://www.meigen.ai/api/mcp"
bearer_token_env_var = "MEIGEN_API_TOKEN"
startup_timeout_sec = 30
tool_timeout_sec = 240
```

**还没配 Key、只想先试公开查询时**，省略命令中的 `--bearer-token-env-var` 和 TOML 中的 `bearer_token_env_var`，设置好环境变量后再添加。

使用需要认证的工具前，在**启动 Codex 的环境**中本地设置 `MEIGEN_API_TOKEN`。这里填写 MeiGen Key，不是 OpenAI API Key。Codex 不会自动加载项目的 `.env.local`。如果从桌面启动时没有继承终端变量，可在客户端提供的私有 MCP 连接设置中填写 `Authorization: Bearer …` 请求头，或自行在私有用户级配置中设置 `http_headers.Authorization`。直接使用 Authorization 请求头时，请移除 `bearer_token_env_var`，避免连接继续依赖缺失的环境变量。不要将 Key 发到聊天里或写入共享项目文件。

**本地连接——需要自动处理本地图片、ComfyUI 或本地专属工具时：**用下面这段**替换**远程条目。建议使用 Node.js 22 或更高版本。

```toml
[mcp_servers.meigen]
command = "npx"
args = ["-y", "meigen@2.0.1"]
env_vars = ["MEIGEN_API_TOKEN"]
startup_timeout_sec = 90
tool_timeout_sec = 240
```

它会把本地配置的 `MEIGEN_API_TOKEN` 传给 npm 进程。也可先执行 `codex mcp add meigen -- npx -y meigen@2.0.1` 注册本地命令，再补上上述环境变量传递和超时设置。`meigen init codex` 尚不支持，请使用 Codex 自身的 MCP 配置方式。

配置后重启或重新连接。在 Codex CLI 中，`codex mcp list` 可检查注册信息，`/mcp` 可查看连接状态。然后说 **“列出 MeiGen 可用的 Skills 和当前价格”**，验证一次真实工具调用，不生成图片、不扣点。仅保存配置不代表已经连接成功。较长的视频任务可能需要更长的工具超时。

<a id="chatgpt-web"></a>

### ChatGPT 网页端（目前仅公开查询）

如果账号与工作区允许自定义 MCP，开启 **Developer mode**，创建自定义远程应用／插件，填写 `https://www.meigen.ai/api/mcp`，认证选择 **No Authentication**。连接后在对话中选用该应用，查询公开模型、Skill 价格或画廊灵感。具体设置入口与可用范围以 OpenAI 的 [Developer mode 指南](https://developers.openai.com/api/docs/guides/developer-mode#how-to-use)为准。仅发送聊天消息不能把本地 npm 服务安装到 ChatGPT 网页端。

**这条 ChatGPT 网页连接目前尚不能使用 MeiGen 付费工具。**OpenAI 的托管 MCP 客户端[不能发送自定义 API Key](https://developers.openai.com/plugins/build/auth#client-identification)，而 MeiGen 的生成、图片上传与 `check_skill` 恢复需要 Bearer API Key（`check_generation` 按已知 generationId 可公开查询，按 requestId 恢复仍需 Key）；完整支持需要 MeiGen 接入 OAuth。这些功能请使用 Codex 或其他支持 Bearer 请求头的客户端，不要把 Key 放进聊天或服务 URL。

### 本地 npm MCP（Node.js）

建议使用 Node.js 22 或更高版本。下方示例固定为 **meigen@2.0.1**。修改安装版本或连接配置后，重启或重连宿主。五项 Skills 仍调用 MeiGen 云端，需要完成前述账号配置。

<a id="claude-code"></a>

### Claude Code 插件(npm,本地工具)

```bash
# 添加插件源
/plugin marketplace add jau123/MeiGen-AI-Design-MCP

# 安装
/plugin install meigen@meigen-marketplace
```

**安装完成后重启 Claude Code**（关闭再打开，或新建终端标签页）。

**其他插件市场** — 也可通过 [wshobson/agents](https://github.com/wshobson/agents)（30k+ stars）安装：

```bash
/plugin marketplace add wshobson/agents
/plugin install meigen-ai-design@claude-code-workflows
```

> 该市场不包含 MCP 服务配置。安装后需手动添加到项目 `.mcp.json`：
> ```json
> { "mcpServers": { "meigen": { "command": "npx", "args": ["-y", "meigen@2.0.1"] } } }
> ```

#### 首次配置

重启后，免费功能无需配置即可使用 — 试试问：

> "帮我搜索一些创意灵感"

Claude Code 插件提供配置命令：

```
/meigen:setup
```

使用五项 Skills 时，选择 **MeiGen 云端**，在连接设置中配置 MeiGen Key。普通生图也可选择 ComfyUI 或 OpenAI 兼容 API。修改配置后重启 Claude Code；不要把密钥粘贴到对话里。

<a id="other-clients"></a>

### Cursor / VS Code / Windsurf / Roo Code

一行命令为任意支持的 AI 编程工具配置 MeiGen：

```bash
npx -y meigen@2.0.1 init cursor      # Cursor
npx -y meigen@2.0.1 init vscode      # VS Code / GitHub Copilot
npx -y meigen@2.0.1 init windsurf    # Windsurf
npx -y meigen@2.0.1 init roo         # Roo Code
npx -y meigen@2.0.1 init claude      # Claude Code（项目级）
```

自动写入正确格式的 MCP 配置文件。如果配置文件已存在，MeiGen 会合并写入，不会覆盖你的其他 MCP 服务。

`init` 生成的配置跟随 npm 默认发布标签自动更新；上面的手写示例则固定在 2.0.1。需要固定版本时，把生成配置中的 `args` 改为 `["-y", "meigen@2.0.1"]`，再重启客户端。

<a id="openclaw"></a>

### OpenClaw

从 [ClawHub](https://clawhub.ai/plugins/meigen-ai-design) 安装完整插件（包含技能与显式 MCP 连接；其他扩展取决于客户端加载方式）：

```bash
openclaw plugins install clawhub:meigen-ai-design
```

或仅安装技能（不含命令/agents）：

```bash
npx clawhub@latest install creative-toolkit
```

### CLI 模式(不需要 MCP 宿主)

如果你想在 shell 脚本、CI 流水线或终端中直接用 AI 生图,MeiGen 同一个 npm 包里自带一个 `gen` 命令。

```bash
# 在本地设置 token（桌面浏览器访问 https://www.meigen.ai/profile/api-keys 创建）
export MEIGEN_API_TOKEN=meigen_sk_...

# 生图
npx -y meigen@2.0.1 gen --prompt "阳光厨房里的三花猫"

# 指定模型 + 比例
npx -y meigen@2.0.1 gen -p "科技 logo" -m midjourney-v8.1 -r 1:1

# 带参考图(本地路径自动上传)
npx -y meigen@2.0.1 gen -p "产品 hero shot" --ref ~/Desktop/bottle.jpg

# 只提交不等待 — 输出 generationId(适合 CI)
npx -y meigen@2.0.1 gen -p "..." --no-wait

# JSON 输出(适合 jq 管道)
npx -y meigen@2.0.1 gen -p "..." --json | jq -r '.imageUrls[0]'
```

CLI 生成的图像保存到 `~/Pictures/meigen/`（可用 `MEIGEN_OUTPUT_DIR` 覆盖）。五项 Skills 返回结果链接，由宿主预览或下载。

`meigen gen --help` 查看所有参数。

### 其他 MCP 兼容客户端

添加到 MCP 配置文件（如 `.mcp.json`、`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "meigen": {
      "command": "npx",
      "args": ["-y", "meigen@2.0.1"],
      "env": {
        "MEIGEN_API_TOKEN": "meigen_sk_..."
      }
    }
  }
}
```

> 即使没有 API Key，免费功能（灵感搜索、提示词增强、模型列表）也可以直接使用。

### Hermes Agent (NousResearch)

[Hermes Agent](https://github.com/NousResearch/hermes-agent) 原生支持 MCP — 在 `~/.hermes/config.yaml` 加上:

```yaml
mcp_servers:
  meigen:
    command: "npx"
    args: ["-y", "meigen@2.0.1"]
    env:
      MEIGEN_API_TOKEN: "meigen_sk_..."
    timeout: 2700         # generate_video 会等到服务端报终态(长视频可达 15+ 分钟),Hermes 默认 120s 会超时
    connect_timeout: 120  # 首次 npx 下载可能需要一分钟
```

> `timeout: 2700` 和 `connect_timeout: 120` 这两个覆盖很重要 — Hermes 默认(120s / 60s)是给短命令调好的,视频生成或首次 npx 下载会超。

---

<h2 id="功能一览">功能一览</h2>

### 接入已有工作流

上层 Skill 可以先写 N 个脚本，再调用 MeiGen 生成首帧，随后把已完成的首帧 URL 传给 `generate_video(firstFrame=...)`。同一次调用里还可以带上 `referenceVideos`、`referenceAudios`，并在提示词里用 "Video 1" / "Audio 1" 指名引用。提示词、模型／供应商、比例、已批准数量／预算和展示均由上层负责；创意规划和插件 Agent 可选，已确定的请求无需逐步重复确认。

每个 MeiGen 逻辑步骤在调用前保存 UUID `requestId` 和精确输入。用 `wait: false` 提交后立即返回任务句柄；本地 npm 还支持 `download: false`。既有本地默认值仍是 `wait: true`、`download: true`，异步调用跳过下载。远程 MCP 返回 URL，没有 download 设置。中断后用原 `requestId` 或 `generationId` 调用 `check_generation`；按请求 ID 恢复需要同账号 MeiGen Key，远程已知 generationId 状态仍可公开查询。从 `structuredContent` 读取状态、句柄、URL、错误和查询建议。

本地 npm 最多同时进行 4 个 API **提交**，查询／下载不占提交槽位；ComfyUI 一次执行一个任务。上层还应限制未完成任务数量，并在已批准预算中预留在途费用。实际后端限流与 `Retry-After` 是权威依据。已授权视频可有限并发，不存在“总计最多 10 张”或整批原子预算承诺。

本地等待会在观察预算内重试暂态状态查询；取消等待后仍保留可恢复的 ID。完成结果的媒体类型与原意图不符时，保留实际结果，并返回 `requestedMediaType` 和 `review_media_type`。恢复路由缺失或无法识别时返回 `endpoint_unavailable`／`check_backend`，不能据此重新提交。应先部署匹配的后端，回滚时保留恢复接口。

详见[持久化步骤 ID、首帧／视频调用与恢复规则](COMPOSABLE_WORKFLOWS.zh-CN.md)。

### MCP 工具

两种入口都提供下方 14 项云端工具。本地 npm 另加三项本地工具，合计 **17 项**。只读查询不消耗生成积分；`check_skill` 仍须使用拥有该请求的 Key。

| 工具 | 入口 | 计费 / 用途 |
|---|---|---|
| `search_gallery` | 两种 | 不消耗生成积分；搜索灵感并返回图片预览，每次最多 3 条。配置了 MeiGen Key 时该请求带 Key 调用，计入该账户的每日搜索额度，而不是共享的按 IP 限额。本地 npm 还内置 1,446 条提示词。 |
| `get_inspiration` | 两种 | 不消耗生成积分；获取画廊条目的完整提示词、图片和元数据。 |
| `list_models` | 两种 | 不消耗生成积分；查看当前支持的模型和选项。 |
| `generate_image` | 两种 | 生成图片。远程使用 MeiGen 购买积分；本地也支持已配置的自带 API / ComfyUI 后端。 |
| `generate_video` | 两种 | 需要 MeiGen Key 与购买积分；模型选项以 `list_models` 为准。参考素材用 `referenceVideos` / `referenceAudios` 传（`images.meigen.ai` 的 URL——通常是此前 MeiGen 生成的成片——或仅限本地 npm 版的本地 `.mp4`/`.mov`/`.wav`/`.mp3` 文件（自动上传）；远程 MCP 只收 `images.meigen.ai` 的 URL，其它域名会被拒绝）；每个模型的片段数量与秒数上限以 `list_models` 为准，参考音频不计费。 |
| `check_generation` | 两种 | 不新增生成费用；中断后恢复查询图片/视频状态。 |
| `list_skills` | 两种 | 不需要 Key，不消耗生成积分；查看 Skill 参数、默认值和价格。 |
| `upload_skill_image` | 两种 | 需要 MeiGen Key；准备参考图，不消耗生成积分。 |
| `remove_background` | 两种 | MeiGen 购买积分；一张透明抠图。 |
| `generate_product_detail_images` | 两种 | MeiGen 购买积分；1–6 张，按模块计费。 |
| `generate_marketing_poster` | 两种 | MeiGen 购买积分；一张海报，参考图可选。 |
| `generate_ai_background` | 两种 | MeiGen 购买积分；一张白底、智能或自定义背景的商品图。 |
| `upscale_image` | 两种 | MeiGen 购买积分；基于原图做保真或创意增强。 |
| `check_skill` | 两种 | 使用同一 MeiGen Key，不新增生成费用；返回成图、失败模块和退款状态。 |
| `enhance_prompt` | 仅本地 | 本地提示词增强，不消耗生成积分。 |
| `manage_preferences` | 仅本地 | 读写本地偏好，不消耗生成积分。 |
| `comfyui_workflow` | 仅本地 | 管理本地 ComfyUI 工作流，不消耗 MeiGen 生成积分。 |

本地普通图片/视频生成可以保存到配置的输出目录；两种入口的 Skills 都返回预览/下载链接。同名工具在两种传输中的参数可能不同，客户端应读取当前连接的工具列表。

### 快捷命令

这些命令需要 Claude Code 插件；仅连接 MCP 服务不会安装它们。

| 命令 | 说明 |
|------|------|
| `/meigen:gen <提示词>` | 快速生图 — 跳过对话，直接生成 |
| `/meigen:find <关键词>` | 搜索 1,446 条精选提示词获取灵感 |
| `/meigen:models` | 浏览和切换当前会话的 AI 模型 |
| `/meigen:setup` | 交互式后端配置向导 |

### 独立 CLI 模式

适合 shell 脚本、CI 流水线以及不跑 MCP 宿主的终端用户:

```bash
export MEIGEN_API_TOKEN=meigen_sk_...
npx -y meigen@2.0.1 gen --prompt "阳光厨房里的三花猫"
npx -y meigen@2.0.1 gen -p "logo design" -m midjourney-v8.1 -r 1:1 --json
```

完整参数见 [CLI 模式(不需要 MCP 宿主)](#cli-模式不需要-mcp-宿主) 章节。

### 智能 Agent

Claude Code 插件包含用于普通生图的专用子 Agent。五项 Skills 自行完成规划，不依赖这些 Agent：

| Agent | 用途 |
|-------|------|
| `image-generator` | 可选执行器；保留调用方参数，返回任务句柄／结果 |
| `prompt-crafter` | 为批量生成撰写多个不同风格的提示词（使用 Haiku 模型，更节省成本） |
| `gallery-researcher` | 深度灵感搜索，不会占用主对话的上下文（使用 Haiku 模型） |

### 输出风格

通过 `/output-style` 切换创意模式：

- **Creative Director** — 创意总监模式，以视觉叙事、情绪板和设计思维组织回复
- **Minimal** — 极简模式，只输出图片和文件路径，无多余解释。适合批量工作流

### 自动化 Hook

自动预览默认关闭。只有在插件宿主环境显式设置 `MEIGEN_AUTO_OPEN=1`，才会在 macOS 打开已保存图片；工作流其余展示由上层控制。异步／不下载调用没有可打开的本地图片。

- **配置检查** — 会话启动时自动验证后端配置，缺失时引导完成设置
- **可选预览** — 显式启用 `MEIGEN_AUTO_OPEN=1` 后在 macOS 打开已保存图片

---

<h2 id="生成后端">生成后端</h2>

**本地 npm 服务**的 `generate_image` 支持三种后端，可配置一个或多个。**远程服务与五项 Skills 使用 MeiGen 云端**；Skills 不支持改用自带 Key 的供应商或 ComfyUI。

### ComfyUI — 本地免费

在自己的 GPU 上运行，完全控制模型、采样器和工作流参数。支持导入任意 ComfyUI API 格式的工作流 — MeiGen 自动检测 KSampler、CLIPTextEncode、EmptyLatentImage、LoadImage 节点。

```json
{
  "comfyuiUrl": "http://localhost:8188",
  "comfyuiDefaultWorkflow": "txt2img"
}
```

> 适合运行本地模型。使用本地文件和本地工作流时，生成过程可留在本机；MeiGen Skills 仍使用云端服务。

### MeiGen 云端

云端 API，支持多种模型：GPT Image 2.0、Nanobanana 2、Seedream 5.0 等。无需 GPU。

**获取 API Key 与积分：**

1. 登录后，在桌面浏览器打开 [API Keys](https://www.meigen.ai/profile/api-keys)。
2. 创建以 `meigen_sk_` 开头的 Key，保存在 MCP 连接设置中。
3. 使用同一账号，在[个人主页 → 充值](https://www.meigen.ai/profile)或[手机会员与积分页](https://www.meigen.ai/m/premium)购买积分。

```json
{ "meigenApiToken": "meigen_sk_..." }
```

**普通生图的分辨率与质量** — `generate_image` 的选项随模型而异，当前默认模型和支持值请用 `list_models` 查询：

- `resolution`：例如 `"1K"` / `"2K"` / `"4K"` — 海报、印刷、大屏壁纸时升级
- `quality`：例如 `"low"` / `"medium"` / `"high"` — 快速草图、缩略图可用 `"low"` 省积分

**Seedance 2.0 视频**现已支持**原生 4K — 但仅 `pro` 档位**(`mini`/`fast` 最高 480p/720p);需要 1080p/4K 输出时传 `tier: "pro"`。

每个模型支持的分辨率和质量档不同 — 运行 `list_models` 查看各模型实际支持的档位。最新价格请查看 [meigen.ai/model-comparison](https://www.meigen.ai/model-comparison)。

### 自带 API（OpenAI 兼容）

接入**任意**符合 OpenAI 接口规范的生图 API — Together AI、Fireworks AI、DeepInfra、硅基流动，或你自己的端点。只需提供 Key、请求地址和模型名：

```json
{
  "openaiApiKey": "sk-...",
  "openaiBaseUrl": "https://api.together.xyz/v1",
  "openaiModel": "black-forest-labs/FLUX.1-schnell"
}
```

> 三种后端都支持**参考图**。MeiGen 和 OpenAI 兼容 API 接受 URL；ComfyUI 同时支持 URL 和本地文件路径，会将参考图注入到工作流的 LoadImage 节点中。

---

## 配置

### Claude Code 插件配置

```
/meigen:setup
```

此命令属于 Claude Code 插件，其他 MCP 宿主应使用自己的连接设置。五项 Skills 需要 MeiGen Key；OpenAI 兼容凭证和 ComfyUI 仅用于普通生图。凭证应保存在连接设置或本地配置文件中，不要粘贴到聊天消息里。

### 配置文件

配置存储在 `~/.config/meigen/config.json`。ComfyUI 工作流存储在 `~/.config/meigen/workflows/`。

### 环境变量

环境变量优先级高于配置文件。

| 变量 | 说明 |
|------|------|
| `MEIGEN_API_TOKEN` | MeiGen API Key；五项 Skills 和 MeiGen 生成必需 |
| `MEIGEN_BASE_URL` | 本地服务调用的 API 源站，默认 `https://www.meigen.ai`；开发后端时显式指定本地地址。 |
| `MEIGEN_REQUEST_STORE_DIR` | 本地私有回执目录，默认 `~/.meigen/requests`。填写当前用户所有、可写、非符号链接目录的绝对路径，POSIX 权限须为 0700。存储不可用时使用进程内缓存并返回 `receiptWarning`；上层仍需保存返回的请求 ID 和原始参数，以便重启后恢复。 |
| `UPLOAD_GATEWAY_URL` | 本地参考图上传网关，默认 `https://gen.meigen.ai`；独立于 `MEIGEN_BASE_URL`。 |
| `OPENAI_API_KEY` | 你的 API Key（任意 OpenAI 兼容供应商） |
| `OPENAI_BASE_URL` | API 地址 — 修改此项以接入 Together AI、Fireworks AI 等 |
| `OPENAI_MODEL` | 端点支持的模型 ID |
| `COMFYUI_URL` | ComfyUI 服务地址（默认：`http://localhost:8188`） |
| `MEIGEN_OUTPUT_DIR` | 生成图像的本地保存目录（默认：`~/Pictures/meigen`）。沙箱环境（如 OpenClaw）无法访问默认路径时使用。 |
| `MEIGEN_VIDEO_OUTPUT_DIR` | 生成视频的本地保存目录（默认：`~/Movies/meigen`）。 |
| `XDG_PICTURES_DIR` | 仅 Linux — `MEIGEN_OUTPUT_DIR` 未设时,图像保存到 `$XDG_PICTURES_DIR/meigen`(由桌面环境设置)。未设时回退 `~/Pictures/meigen`。 |
| `XDG_VIDEOS_DIR` | 仅 Linux — 同 `XDG_PICTURES_DIR` 但对视频生效,回退 `~/Movies/meigen`。 |

---

## 隐私

MeiGen MCP 尊重你的隐私。以下是数据处理方式：

- **ComfyUI（本地）** — 使用本地工作流和本地文件时，可以不经过云端生成。画廊查询和 MeiGen Skills 仍会使用外部服务。
- **MeiGen 云端与 Skills** — 提示词和参考图由 MeiGen 及其生成供应商处理，结果图片存储在 Cloudflare R2。详见 [MeiGen 隐私政策](https://www.meigen.ai/privacy-policy-zh)。
- **OpenAI 兼容 API** — 提示词和参考图会发送到你配置的 API 端点。请参考你的服务商隐私政策。
- **参考图上传** — 本地文件通过配置的上传网关（默认 `gen.meigen.ai`）上传到 Cloudflare R2。本地 MCP 的普通生成和标准 Skill 参考图以 4096px / 8 MiB 为目标；独立 `meigen gen` CLI 仍以 2 MiB 为压缩目标；upscale 保留原尺寸，限制见前文。Skill 图片会完整解码、修正方向、清除元数据并保留透明；GIF 参考图只取首帧。远程 Skill 上传需要 MeiGen Key。持有链接的人可以访问参考图。重试时保留已受理的 URL，同时保留原始素材并下载需要保存的结果；链接不作永久存档保证。ComfyUI 可直接使用本地路径而不上传。
- **灵感搜索** — 带查询词时会请求 MeiGen API(查询文本发送到 `www.meigen.ai`);分类浏览与离线兜底使用内置本地数据。**提示词增强**完全本地运行,不调用外部 API。

本地 npm 服务不添加遥测。发送到 MeiGen 的请求适用其服务与隐私政策。

### 自定义存储后端

如果你希望使用自己的 S3/R2 存储桶上传参考图,设置 `UPLOAD_GATEWAY_URL` 环境变量或在 `~/.config/meigen/config.json` 中设置 `uploadGatewayUrl`,指向你自己的 presign 接口。接口需实现:

```
POST /upload/presign
Content-Type: application/json

请求:  { "filename": "photo.jpg", "contentType": "image/jpeg", "size": 123456 }
响应:  { "success": true, "presignedUrl": "https://...", "publicUrl": "https://..." }
```

`presignedUrl` 用于 `PUT` 上传，`publicUrl` 是返回给用户的公开可访问 URL。此配置用于本地上传。普通 Skill 的本地上传若返回自定义 CDN，服务会自动通过已鉴权的 `/api/skills/upload` 转存再提交。upscale 则将公开原图链接直接交给后端验证和准备。自定义网关返回的图片必须无需登录、无需重定向即可公开访问。

---

## 常见问题

| 问题 | 下一步 |
|---|---|
| 看不到新增 Skills | 远程：后端部署后刷新/重连工具列表。本地：确认连接使用 `meigen@2.0.1` 后重启。仅安装 npm 不会部署 API。 |
| Key 无效或缺失 | 在[桌面 API Keys](https://www.meigen.ai/profile/api-keys)创建/检查 Key，更新 MCP 连接请求头或 `MEIGEN_API_TOKEN`。修改环境变量后重启本地服务，不要把 Key 发到聊天中。 |
| 网站显示有积分，API 却提示不足 | API **只消耗购买积分**，不使用每日免费积分。使用同一账号在[个人主页 → 充值](https://www.meigen.ai/profile)购买积分后，再让助手继续；被拒绝的请求不应反复查询状态。 |
| 图片上传失败 | 使用真实本地文件（本地 npm）或公开 HTTPS 图片直链，检查格式和大小，避免需登录或重定向的链接。宿主无法读取附件时改用直链。上传失败尚未开始生成。 |
| 工具超时或宿主重启 | Skills 用 `check_skill`，普通图片/视频任务用 `check_generation` 恢复，不要自动发起新的付费请求。宿主默认 60 秒工具超时时，可将 Skill 提交的超时调长，例如 240 秒。 |
| 部分商品详情图失败 | 保留并展示已完成的图片，分别说明失败模块及返回的退款状态。不要自动重做整批或增加付费替代图。 |
| 请求被限流 | 按返回的指引等待。每日请求上限与积分余额不同，反复查询或充值不会重置次数。 |
| 已配 OpenAI 或 ComfyUI，Skill 仍要求 MeiGen Key | 这些后端用于本地普通生图；五项 Skills 使用 MeiGen 云端与购买积分。 |

Skill 客户端实现说明：在内部生成 `requestId`，保存原始参数，中断后先查询 `check_skill`。遵循 `nextAction`；处理中通常建议间隔 10 秒查询。恢复时完整沿用 `retryParameters`，包括原上传 URL。新 ID 代表新的付费尝试，同一 ID 下修改参数会被拒绝。这些 ID 应由客户端管理，无需向用户询问。

<a id="upgrading"></a>

## 从 1.4.0 升级

- **远程 MCP：** URL 和有效的 MeiGen Key 可继续使用。后端发布后重新连接，调用 `list_skills`；应看到五项 Skills、共 14 个工具。仅更新 npm 不会启用远程 API。
- **本地 npm：** 固定版本配置改为 `meigen@2.0.1` 并重启；全局安装用户执行 `npm install -g meigen@2.0.1`。本地共 17 个工具。先确认 npm 上已有该版本。
- **插件用户：** Claude marketplace、OpenClaw 插件与独立 ClawHub Skill 分别更新；仅更新 npm 不会刷新安装时复制的指导文件。使用插件内置连接时，不要再手动添加第二套 MCP。
- **工作流调用：** 本地保留 `wait: true`／`download: true` 默认值；新工作流应持久化 UUID `requestId`、用 `wait: false` 并按原 ID 恢复。远程保留旧 `attemptId`，但无法对所有旧回执追溯证明历史参数一致性。服务器和插件指引都需更新，才能使用可选创意流程。
- **现有配置和任务：** 通用生图仍可使用原来的 MeiGen/OpenAI/ComfyUI 配置；五项 Skills 需要 MeiGen Key 与购买积分。中断任务保留原 ID 和输入，先恢复，不能为升级重新付费提交。
- **材料变化：** 本地 Skill 路径必须为绝对路径、`~/` 或 `file://`；不再按不可见的进程目录猜相对路径。图片会清除元数据，GIF 只取首帧；upscale 要传静态原图。保留原始素材并下载需要保存的结果；结果链接不作永久存档保证。

## 发布维护

npm 包版本 **2.0.1** 与 MCP 协议日期、SDK 版本是不同的版本维度。

维护者请按 [RELEASING.md](https://github.com/jau123/MeiGen-AI-Design-MCP/blob/main/RELEASING.md) 完成 2.0.1 的构建、包检查与发布。`NPM_TOKEN` 仅按该文档保存在本仓库已忽略的 `.env.local` 中，用于授权 npm 发布；它与用户调用服务的 `MEIGEN_API_TOKEN` 不同。两类凭证都不得进入提交或发布包。

## 许可证

[MIT](LICENSE) — 个人和商业用途均免费。
