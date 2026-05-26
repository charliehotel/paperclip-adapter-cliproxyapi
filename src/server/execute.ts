import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  renderPaperclipWakePrompt,
  renderTemplate,
  joinPromptSections,
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
  parseObject,
  asString,
  asNumber,
} from "@paperclipai/adapter-utils/server-utils";
import fs from "node:fs/promises";

const DEFAULT_BASE_URL = "http://127.0.0.1:8317/v1";
const DEFAULT_MODEL = "agy-3.1-pro-high";
const MAX_TURNS = 25;

function getBaseUrl(config: Record<string, unknown>): string {
  return String(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function getModel(config: Record<string, unknown>): string {
  return String(config.model ?? DEFAULT_MODEL);
}

// ---------------------------------------------------------------------------
// System prompt: execution contract + agent instructions (AGENTS.md)
// ---------------------------------------------------------------------------
async function buildSystemPrompt(ctx: AdapterExecutionContext): Promise<string> {
  const { agent, context, config } = ctx;

  // 1. Render the default execution contract template
  const executionContract = renderTemplate(
    DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
    { agent, context },
  );

  // 2. Read AGENTS.md instructions if available
  let agentInstructions = "";
  const instructionsPath = asString(config.instructionsFilePath, "");
  if (instructionsPath) {
    try {
      agentInstructions = await fs.readFile(instructionsPath, "utf-8");
    } catch {
      // Instructions file not found or unreadable — continue without it
    }
  }

  // 3. Model profile hint
  const modelProfile = context.paperclipModelProfile;
  const profileHint = modelProfile
    ? `Model profile: ${JSON.stringify(modelProfile)}`
    : "";

  return joinPromptSections([
    executionContract,
    agentInstructions ? `## Agent Instructions (AGENTS.md)\n\n${agentInstructions}` : null,
    profileHint || null,
  ]);
}

// ---------------------------------------------------------------------------
// User prompt: wake payload + issue details + task markdown
// ---------------------------------------------------------------------------
function buildUserPrompt(ctx: AdapterExecutionContext): string {
  const { context } = ctx;

  const sections: (string | null)[] = [];

  // 1. Full wake payload (issue body, comments, execution stage, disposition rules, etc.)
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake);
  if (wakePrompt) {
    sections.push(wakePrompt);
  }

  // 2. Task markdown (issue body + wake comment combined as markdown)
  const taskMarkdown = asString(context.paperclipTaskMarkdown as string, "");
  if (taskMarkdown) {
    sections.push(`## Task Details\n\n${taskMarkdown}`);
  }

  // 3. Issue details (structured)
  const issue = parseObject(context.paperclipIssue);
  if (issue.id) {
    const issueLines = [
      `## Issue Context`,
      `- ID: ${issue.id}`,
      issue.identifier ? `- Identifier: ${issue.identifier}` : null,
      issue.title ? `- Title: ${issue.title}` : null,
      issue.workMode ? `- Work Mode: ${issue.workMode}` : null,
    ].filter(Boolean);

    // Include description if it exists and isn't already in taskMarkdown
    if (issue.description && !taskMarkdown) {
      issueLines.push("", "### Issue Description", "", String(issue.description));
    }

    sections.push(issueLines.join("\n"));
  }

  // 4. Continuation summary from previous runs
  const continuation = parseObject(context.paperclipContinuationSummary);
  if (continuation.body) {
    sections.push(
      `## Continuation Summary (from previous run)\n\n${continuation.body}`,
    );
  }

  // 5. Harness checkout status
  if (context.paperclipHarnessCheckedOut === true) {
    sections.push(
      "Note: The harness already checked out this issue for the current run. Do not call checkout again.",
    );
  }

  // 6. Fallback: if absolutely nothing was extracted, include raw context summary
  if (sections.length === 0) {
    const taskId = asString(context.taskId as string, "");
    const taskTitle = asString(context.taskTitle as string, "");
    const wakeReason = asString(context.wakeReason as string, "");
    sections.push(
      [
        `Task ID: ${taskId}`,
        `Task title: ${taskTitle}`,
        `Wake reason: ${wakeReason}`,
        "",
        "Continue the assigned Paperclip task.",
      ].join("\n"),
    );
  }

  return joinPromptSections(sections);
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------
export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const baseUrl = getBaseUrl(config);
  const model = getModel(config);
  const apiKey = String(config.apiKey ?? "paperclip-local");

  // Build proper system + user messages
  const systemPrompt = await buildSystemPrompt(ctx);
  const userPrompt = buildUserPrompt(ctx);

  ctx.onLog("stdout", `[cliproxyapi] model=${model}\n`);
  ctx.onLog("stdout", `[cliproxyapi] endpoint=${baseUrl}\n`);
  ctx.onLog(
    "stdout",
    `[cliproxyapi] system prompt length=${systemPrompt.length}, user prompt length=${userPrompt.length}\n`,
  );

  // Log context keys for diagnostics (not the full content)
  const contextKeys = Object.keys(ctx.context ?? {});
  ctx.onLog("stdout", `[cliproxyapi] context keys: ${contextKeys.join(", ")}\n`);

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // Build request body
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: asNumber(config.temperature as number, 0.2),
    stream: false,
  };

  // Multi-turn tool-call loop
  let turnCount = 0;
  let lastContent = "";

  while (turnCount < MAX_TURNS) {
    turnCount++;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();

    if (!response.ok) {
      ctx.onLog("stderr", text);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        summary: `CLIProxyAPI request failed: HTTP ${response.status}`,
        resultJson: {
          status: response.status,
          body: text,
        },
      };
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      ctx.onLog("stderr", text);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        summary: "CLIProxyAPI returned non-JSON response",
        resultJson: { body: text },
      };
    }

    const choice = data?.choices?.[0];
    const message = choice?.message;

    if (!message) {
      ctx.onLog("stderr", `[cliproxyapi] No message in response choice\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        summary: "CLIProxyAPI returned response with no message",
        resultJson: data,
      };
    }

    // Extract text content
    const content = message.content ?? "";
    if (content) {
      lastContent = content;
      ctx.onLog("stdout", `${content}\n`);
    }

    // Check for tool calls
    const toolCalls = message.tool_calls;
    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
      ctx.onLog(
        "stdout",
        `[cliproxyapi] turn ${turnCount}: ${toolCalls.length} tool call(s)\n`,
      );

      // Add assistant message with tool calls to conversation
      messages.push(message);

      // Process each tool call
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name ?? "unknown";
        const toolArgs = toolCall.function?.arguments ?? "{}";
        const toolCallId = toolCall.id ?? `call_${turnCount}_${toolName}`;

        ctx.onLog(
          "stdout",
          `[cliproxyapi] tool_call: ${toolName}(${toolArgs.slice(0, 200)})\n`,
        );

        // For now, we cannot execute tools locally — return a helpful error
        // to the model so it can adapt. In Phase 2, this will be replaced
        // with actual Paperclip API tool execution.
        const toolResult = JSON.stringify({
          error: "tool_execution_not_available",
          message: `Tool '${toolName}' cannot be executed by the CLIProxyAPI adapter. ` +
            `Use the Paperclip API directly via HTTP calls to PAPERCLIP_API_URL ` +
            `to read files, update issues, and manage dispositions. ` +
            `Or complete your task using only the information provided in the wake payload.`,
        });

        messages.push({
          role: "tool",
          content: toolResult,
          // @ts-ignore — tool_call_id is needed for OpenAI-compatible API
          tool_call_id: toolCallId,
        });
      }

      // Update request body for next turn
      requestBody.messages = messages;
      continue;
    }

    // No tool calls — this is the final response
    // Extract usage if available
    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.completion_tokens ?? 0,
          cachedInputTokens: data.usage.cached_tokens ?? 0,
        }
      : undefined;

    ctx.onLog("stdout", `[cliproxyapi] completed in ${turnCount} turn(s)\n`);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "cliproxyapi",
      model,
      usage,
      summary: lastContent
        ? lastContent.slice(0, 500)
        : "CLIProxyAPI run completed.",
      resultJson: data,
    };
  }

  // Exceeded max turns
  ctx.onLog(
    "stderr",
    `[cliproxyapi] exceeded max turns (${MAX_TURNS})\n`,
  );

  return {
    exitCode: 1,
    signal: null,
    timedOut: true,
    provider: "cliproxyapi",
    model,
    summary: lastContent
      ? `Max turns exceeded. Last output: ${lastContent.slice(0, 300)}`
      : `CLIProxyAPI exceeded ${MAX_TURNS} turns without completion.`,
    resultJson: { maxTurnsExceeded: true, turns: turnCount },
  };
}
