# paperclip-adapter-cliproxyapi

[🇰🇷 한국어 버전](./README.ko.md)

An external adapter plugin for [Paperclip](https://github.com/paperclipai/paperclip) that integrates agents with [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). It serves as a local, OpenAI-compatible proxy allowing you to run Paperclip agents using Google Gemini, Anthropic Claude, and Antigravity models.

## Features

- **Standard Compliance**: Fully implements Paperclip's `ServerAdapterModule` and interfaces.
- **Declarative Configuration**: Exposes configuration schema (`getConfigSchema`) for easy UI input of connection parameters (Base URL, API Key, Temperature).
- **Standardized Environment Tests**: Implements a robust `testEnvironment` function conforming to `AdapterEnvironmentTestResult` to ensure smooth connection diagnostics without UI crashes.
- **Model Discovery**: Dynamically matches and resolves models exposed by CLIProxyAPI.

## Prerequisites

- **Paperclip** (installed and running).
- **CLIProxyAPI** server running locally (typically at `http://127.0.0.1:8317/v1`).

## Installation

You can install this adapter directly via the Paperclip UI:

1. Open Paperclip and navigate to **Instance Settings** -> **Adapters**.
2. Click **Install Adapter**.
3. Select **Local Path** and enter the full absolute path to the cloned repository folder.

   *Example (macOS/Linux):*
   ```text
   /Users/yourname/paperclip-adapter-cliproxyapi
   ```

   *Example (Windows):*
   ```text
   C:\Users\yourname\paperclip-adapter-cliproxyapi
   ```
4. Click **Install**. The adapter will compile and register under the type `cliproxyapi`.

*Alternatively, you can register it by adding it to your `.paperclip/adapter-plugins.json` file.*

## Configuration

Once installed, you can configure an agent to use CLIProxyAPI:

1. Navigate to the agent's **Configuration** tab.
2. Select **CLIProxyAPI** as the **Adapter Type**.
3. A **Primary Model** dropdown will appear showing all models discovered from the CLIProxyAPI server (e.g. `claude-sonnet-4-6`, `gemini-3.1-pro`, `agy-3.5-flash-high`).
4. Set the adapter-specific fields under **Permissions & Configuration**:
   - **Base URL**: The connection endpoint (default: `http://127.0.0.1:8317/v1`).
   - **API Key**: Authentication token (default: `paperclip-local`).
   - **Temperature**: Sampling temperature (default: `0.2`).
5. Click **Test** to verify connection reachability.
6. Click **Save** to apply the configuration.

## Development

To make changes to this adapter, clone the repository, install dependencies, and run the build script:

```bash
# Install dependencies
pnpm install

# Compile the TypeScript files
pnpm build

# Run in watch mode for development
pnpm dev
```

## Screenshots

### 1. Installing External Adapter via Local Path
![Installing External Adapter](01_install_external_adapter_local_path.png)

### 2. External Adapter Installed
![External Adapter Installed](02_external_adapters_installed.png)

### 3. Agent Adapter Configuration
![Agent Adapter Configuration](03_agent_adapter_setting_cliproxyapi.png)

### 4. Primary Model Selection & Environment Test
![Model Selection & Test](04_cliproxyapi_model_selection.png)

## Release Notes

<details>
<summary><b>v0.1.3</b></summary>

- **Agent Authentication Fix:** Enabled `supportsLocalAgentJwt` so that API calls are properly attributed to the agent instead of `local-board`. This prevents completed issues from reverting to `todo`.
- **Workspace Context Fix:** Tool calls now resolve file paths and execute commands relative to the actual agent execution workspace (`context.paperclipWorkspace.cwd`) rather than the Paperclip server directory.
- **Diagnostic Logging:** Added `workspace.cwd` and `authToken` presence to startup logs.

</details>

<details>
<summary><b>v0.1.2</b></summary>

- **Tool Execution (Phase 2):** Added 6 tools — `read_file`, `list_directory`, `run_command`, `write_file`, `update_issue`, `add_comment` — enabling the LLM to interact with the file system and Paperclip API.
- **Paperclip API Path Fix:** Fixed `update_issue` and `add_comment` using wrong paths (`/issues/...` → `/api/issues/...`), which caused 404 errors and broken disposition flow.
- **Auth Headers:** All Paperclip API calls now include `Authorization: Bearer`, `X-Paperclip-Run-Id`, and `Content-Type` headers.
- **Safety Guards:** Shell commands are sandboxed with 30s timeout and 50K character output limit.

</details>

<details>
<summary><b>v0.1.1</b></summary>

- **Context Preservation Fix (Phase 1):** Completely rewrote the `buildPrompt` logic in `execute.ts` to forward the full context provided by Paperclip.
- **System Message Support:** The agent execution contract and `AGENTS.md` instructions are now correctly forwarded as a `system` message.
- **Wake Payload Support:** Issue bodies, comments, task markdown, continuation summaries, and execution stages are now properly passed to the model.
- **Tool-Call Loop Foundation:** Implemented a multi-turn conversation loop (up to 25 turns) to support tool calls and intermediate processing.
- **Diagnostics Logging:** Added robust logging for context keys, prompt lengths, and turn counts.

</details>

## License

MIT
