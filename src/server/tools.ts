/**
 * Tool schemas and execution handlers for the CLIProxyAPI adapter.
 *
 * These tools allow the LLM to interact with the local file system and
 * the Paperclip API during an agentic execution loop.
 */

import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { buildPaperclipEnv } from "@paperclipai/adapter-utils/server-utils";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallRequest {
  name: string;
  arguments: string; // JSON string
}

// ---------------------------------------------------------------------------
// Tool Schemas (OpenAI Function Calling format)
// ---------------------------------------------------------------------------

const readFileTool: ToolSchema = {
  type: "function",
  function: {
    name: "read_file",
    description:
      "Read the contents of a file at the given path. " +
      "The path can be absolute or relative to the workspace root. " +
      "Returns the file content as a string. Use this to inspect source code, " +
      "configuration files, documentation, etc.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to read (absolute or relative to workspace root)",
        },
        start_line: {
          type: "integer",
          description: "Optional 1-based start line for partial reads",
        },
        end_line: {
          type: "integer",
          description: "Optional 1-based end line (inclusive) for partial reads",
        },
      },
      required: ["path"],
    },
  },
};

const listDirectoryTool: ToolSchema = {
  type: "function",
  function: {
    name: "list_directory",
    description:
      "List the contents of a directory. Returns file and subdirectory names " +
      "with their types (file/directory) and sizes.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list (absolute or relative to workspace root)",
        },
      },
      required: ["path"],
    },
  },
};

const runCommandTool: ToolSchema = {
  type: "function",
  function: {
    name: "run_command",
    description:
      "Execute a shell command in the workspace directory. " +
      "Use this for searching (grep/rg), building, linting, testing, git operations, etc. " +
      "The command runs in the workspace root directory. " +
      "Returns stdout, stderr, and exit code. Output is truncated to 50,000 characters.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute (e.g. 'grep -rn pattern src/')",
        },
        cwd: {
          type: "string",
          description: "Optional working directory override (absolute path)",
        },
        timeout_ms: {
          type: "integer",
          description: "Optional timeout in milliseconds (default: 30000)",
        },
      },
      required: ["command"],
    },
  },
};

const writeFileTool: ToolSchema = {
  type: "function",
  function: {
    name: "write_file",
    description:
      "Write content to a file. Creates the file if it doesn't exist, " +
      "or overwrites if it does. Parent directories are created automatically.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to write (absolute or relative to workspace root)",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
};

const updateIssueTool: ToolSchema = {
  type: "function",
  function: {
    name: "update_issue",
    description:
      "Update a Paperclip issue's status. Use this to mark the issue as " +
      "'done', 'blocked', 'in_review', or 'in_progress'. " +
      "This is the primary way to set the final disposition of your work.",
    parameters: {
      type: "object",
      properties: {
        issue_id: {
          type: "string",
          description: "Issue ID (UUID). If omitted, uses the current issue from context.",
        },
        status: {
          type: "string",
          enum: ["done", "blocked", "in_review", "in_progress", "todo", "backlog"],
          description: "New status for the issue",
        },
        comment: {
          type: "string",
          description: "Optional comment body to add when updating the issue",
        },
      },
      required: ["status"],
    },
  },
};

const addCommentTool: ToolSchema = {
  type: "function",
  function: {
    name: "add_comment",
    description:
      "Add a comment to a Paperclip issue. Use this to leave progress notes, " +
      "review findings, or any durable written record of your work.",
    parameters: {
      type: "object",
      properties: {
        issue_id: {
          type: "string",
          description: "Issue ID (UUID). If omitted, uses the current issue from context.",
        },
        body: {
          type: "string",
          description: "Comment body (Markdown supported)",
        },
      },
      required: ["body"],
    },
  },
};

/** All tool schemas exposed to the LLM */
export const TOOL_SCHEMAS: ToolSchema[] = [
  readFileTool,
  listDirectoryTool,
  runCommandTool,
  writeFileTool,
  updateIssueTool,
  addCommentTool,
];

// ---------------------------------------------------------------------------
// Helper: resolve the agent execution workspace CWD
// ---------------------------------------------------------------------------

function getWorkspaceCwd(ctx: AdapterExecutionContext): string {
  const context = ctx.context as Record<string, unknown>;

  // 1. Primary: paperclipWorkspace.cwd (set by heartbeat.ts from executionWorkspace)
  const workspace = context.paperclipWorkspace as Record<string, unknown> | undefined;
  if (workspace?.cwd && typeof workspace.cwd === "string") {
    return workspace.cwd;
  }

  // 2. Fallback: worktreePath from paperclipWorkspace
  if (workspace?.worktreePath && typeof workspace.worktreePath === "string") {
    return workspace.worktreePath;
  }

  // 3. Fallback: config.cwd (agent adapter config)
  const configCwd = (ctx.config as Record<string, unknown>).cwd;
  if (typeof configCwd === "string" && configCwd) {
    return configCwd;
  }

  // 4. Last resort: process.cwd() (Paperclip server dir — should not reach here)
  return process.cwd();
}

function resolveWorkspacePath(ctx: AdapterExecutionContext, filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(getWorkspaceCwd(ctx), filePath);
}

// ---------------------------------------------------------------------------
// Helper: get Paperclip API URL
// ---------------------------------------------------------------------------

function getPaperclipApiUrl(ctx: AdapterExecutionContext): string {
  const paperclipEnv = buildPaperclipEnv(ctx.agent);
  return paperclipEnv.PAPERCLIP_API_URL ?? "http://localhost:3100";
}

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

const MAX_OUTPUT_LENGTH = 50_000;

function truncate(text: string, max: number = MAX_OUTPUT_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n... [truncated, ${text.length - max} chars omitted]`;
}

async function handleReadFile(
  ctx: AdapterExecutionContext,
  args: Record<string, unknown>,
): Promise<string> {
  const filePath = resolveWorkspacePath(ctx, String(args.path ?? ""));
  const startLine = typeof args.start_line === "number" ? args.start_line : undefined;
  const endLine = typeof args.end_line === "number" ? args.end_line : undefined;

  try {
    const content = await fs.readFile(filePath, "utf-8");

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split("\n");
      const start = Math.max(1, startLine ?? 1) - 1;
      const end = Math.min(lines.length, endLine ?? lines.length);
      const slice = lines.slice(start, end);
      return truncate(
        `File: ${filePath} (lines ${start + 1}-${end} of ${lines.length})\n\n` +
          slice.map((l, i) => `${start + i + 1}: ${l}`).join("\n"),
      );
    }

    return truncate(`File: ${filePath}\n\n${content}`);
  } catch (err: any) {
    return JSON.stringify({ error: err.code ?? "read_error", message: err.message });
  }
}

async function handleListDirectory(
  ctx: AdapterExecutionContext,
  args: Record<string, unknown>,
): Promise<string> {
  const dirPath = resolveWorkspacePath(ctx, String(args.path ?? "."));

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const type = entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other";
      let size = "";
      if (entry.isFile()) {
        try {
          const stat = await fs.stat(path.join(dirPath, entry.name));
          size = ` (${stat.size} bytes)`;
        } catch {
          // ignore stat errors
        }
      }
      results.push(`${type}\t${entry.name}${size}`);
    }

    return `Directory: ${dirPath}\n\n${results.join("\n")}`;
  } catch (err: any) {
    return JSON.stringify({ error: err.code ?? "readdir_error", message: err.message });
  }
}

async function handleRunCommand(
  ctx: AdapterExecutionContext,
  args: Record<string, unknown>,
): Promise<string> {
  const command = String(args.command ?? "");
  if (!command) {
    return JSON.stringify({ error: "missing_command", message: "No command provided" });
  }

  const workspaceCwd =
    typeof args.cwd === "string" && args.cwd
      ? args.cwd
      : getWorkspaceCwd(ctx);

  const timeoutMs = typeof args.timeout_ms === "number" ? args.timeout_ms : 30_000;

  return new Promise<string>((resolve) => {
    const child = execFile(
      "/bin/sh",
      ["-c", command],
      {
        cwd: workspaceCwd,
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024, // 5MB
        env: {
          ...process.env,
          // Inject Paperclip env vars so commands can use them
          ...(ctx.authToken ? { PAPERCLIP_API_KEY: ctx.authToken } : {}),
          PAPERCLIP_RUN_ID: ctx.runId,
          PAPERCLIP_AGENT_ID: ctx.agent.id,
          PAPERCLIP_COMPANY_ID: ctx.agent.companyId,
        },
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (error as any).code ?? 1 : 0;
        const output = [
          `$ ${command}`,
          `Exit code: ${exitCode}`,
          stdout ? `\nstdout:\n${stdout}` : "",
          stderr ? `\nstderr:\n${stderr}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        resolve(truncate(output));
      },
    );

    // Safety: kill child if it hasn't finished
    if (child.pid) {
      setTimeout(() => {
        try { child.kill("SIGTERM"); } catch { /* already dead */ }
      }, timeoutMs + 1000);
    }
  });
}

async function handleWriteFile(
  ctx: AdapterExecutionContext,
  args: Record<string, unknown>,
): Promise<string> {
  const filePath = resolveWorkspacePath(ctx, String(args.path ?? ""));
  const content = String(args.content ?? "");

  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    return JSON.stringify({ ok: true, path: filePath, bytes: Buffer.byteLength(content) });
  } catch (err: any) {
    return JSON.stringify({ error: err.code ?? "write_error", message: err.message });
  }
}

async function handleUpdateIssue(
  ctx: AdapterExecutionContext,
  args: Record<string, unknown>,
): Promise<string> {
  const issueId =
    typeof args.issue_id === "string" && args.issue_id
      ? args.issue_id
      : ((ctx.context as Record<string, unknown>).paperclipIssue as any)?.id;

  if (!issueId) {
    return JSON.stringify({
      error: "missing_issue_id",
      message: "No issue_id provided and no issue found in context",
    });
  }

  const apiUrl = getPaperclipApiUrl(ctx);
  const status = String(args.status ?? "");

  // Build PATCH body
  const patchBody: Record<string, unknown> = {};
  if (status) patchBody.status = status;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (ctx.authToken) {
      headers["authorization"] = `Bearer ${ctx.authToken}`;
    }
    headers["x-paperclip-run-id"] = ctx.runId;

    const res = await fetch(`${apiUrl}/api/issues/${issueId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patchBody),
    });

    const text = await res.text();

    if (!res.ok) {
      return JSON.stringify({
        error: "api_error",
        status: res.status,
        body: text.slice(0, 2000),
      });
    }

    // Also add comment if provided
    if (typeof args.comment === "string" && args.comment.trim()) {
      await handleAddComment(ctx, { issue_id: issueId, body: args.comment });
    }

    return JSON.stringify({ ok: true, issueId, status, response: text.slice(0, 500) });
  } catch (err: any) {
    return JSON.stringify({ error: "fetch_error", message: err.message });
  }
}

async function handleAddComment(
  ctx: AdapterExecutionContext,
  args: Record<string, unknown>,
): Promise<string> {
  const issueId =
    typeof args.issue_id === "string" && args.issue_id
      ? args.issue_id
      : ((ctx.context as Record<string, unknown>).paperclipIssue as any)?.id;

  if (!issueId) {
    return JSON.stringify({
      error: "missing_issue_id",
      message: "No issue_id provided and no issue found in context",
    });
  }

  const body = String(args.body ?? "");
  if (!body.trim()) {
    return JSON.stringify({ error: "empty_body", message: "Comment body is empty" });
  }

  const apiUrl = getPaperclipApiUrl(ctx);

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (ctx.authToken) {
      headers["authorization"] = `Bearer ${ctx.authToken}`;
    }
    headers["x-paperclip-run-id"] = ctx.runId;

    const res = await fetch(`${apiUrl}/api/issues/${issueId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body }),
    });

    const text = await res.text();

    if (!res.ok) {
      return JSON.stringify({
        error: "api_error",
        status: res.status,
        body: text.slice(0, 2000),
      });
    }

    return JSON.stringify({ ok: true, issueId, commentLength: body.length });
  } catch (err: any) {
    return JSON.stringify({ error: "fetch_error", message: err.message });
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const HANDLERS: Record<
  string,
  (ctx: AdapterExecutionContext, args: Record<string, unknown>) => Promise<string>
> = {
  read_file: handleReadFile,
  list_directory: handleListDirectory,
  run_command: handleRunCommand,
  write_file: handleWriteFile,
  update_issue: handleUpdateIssue,
  add_comment: handleAddComment,
};

/**
 * Execute a single tool call and return the result as a string.
 * Unknown tools return a structured error.
 */
export async function executeToolCall(
  ctx: AdapterExecutionContext,
  toolCall: ToolCallRequest,
): Promise<string> {
  const handler = HANDLERS[toolCall.name];
  if (!handler) {
    return JSON.stringify({
      error: "unknown_tool",
      message: `Tool '${toolCall.name}' is not recognized. Available tools: ${Object.keys(HANDLERS).join(", ")}`,
    });
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.arguments || "{}");
  } catch {
    return JSON.stringify({
      error: "invalid_arguments",
      message: `Failed to parse tool arguments as JSON: ${toolCall.arguments?.slice(0, 200)}`,
    });
  }

  try {
    return await handler(ctx, args);
  } catch (err: any) {
    return JSON.stringify({
      error: "tool_execution_error",
      message: err.message ?? String(err),
    });
  }
}
