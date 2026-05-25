import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";

const DEFAULT_BASE_URL = "http://127.0.0.1:8317/v1";
const DEFAULT_MODEL = "agy-3.1-pro-high";

function getBaseUrl(config: Record<string, unknown>): string {
  return String(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function getModel(config: Record<string, unknown>): string {
  return String(config.model ?? DEFAULT_MODEL);
}

function buildPrompt(ctx: AdapterExecutionContext): string {
  const { agent, context } = ctx;

  return [
    `You are ${agent.name}.`,
    "",
    `Task ID: ${context.taskId ?? ""}`,
    `Task title: ${context.taskTitle ?? ""}`,
    `Wake reason: ${context.wakeReason ?? ""}`,
    "",
    "Continue the assigned Paperclip task. Write concise progress notes in Korean unless code, commands, filenames, APIs, or technical identifiers require English.",
  ].join("\n");
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const baseUrl = getBaseUrl(config);
  const model = getModel(config);
  const apiKey = String(config.apiKey ?? "paperclip-local");

  const prompt = buildPrompt(ctx);

  ctx.onLog("stdout", `[cliproxyapi] model=${model}\n`);
  ctx.onLog("stdout", `[cliproxyapi] endpoint=${baseUrl}\n`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: Number(config.temperature ?? 0.2),
      stream: false,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    ctx.onLog("stderr", text);
    return {
      exitCode: 1,
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
      timedOut: false,
      summary: "CLIProxyAPI returned non-JSON response",
      resultJson: { body: text },
    };
  }

  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    "";

  ctx.onLog("stdout", `${content}\n`);

  return {
    exitCode: 0,
    timedOut: false,
    provider: "cliproxyapi",
    model,
    summary: content ? content.slice(0, 500) : "CLIProxyAPI run completed.",
    resultJson: data,
  };
}
