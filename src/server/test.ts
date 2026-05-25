import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";

const DEFAULT_BASE_URL = "http://127.0.0.1:8317/v1";

function getBaseUrl(config: Record<string, unknown>): string {
  return String(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;
  const baseUrl = getBaseUrl(config);
  const apiKey = String(config.apiKey ?? "paperclip-local");
  const testedAt = new Date().toISOString();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        adapterType: "cliproxyapi",
        status: "fail",
        testedAt,
        checks: [
          {
            code: "MODELS_FETCH_FAILED",
            level: "fail",
            message: `CLIProxyAPI model check failed: HTTP ${response.status}`,
            detail: await response.text(),
            hint: "Please verify your baseUrl and apiKey config, and ensure CLIProxyAPI is running."
          }
        ]
      };
    }

    const data = await response.json();

    return {
      adapterType: "cliproxyapi",
      status: "pass",
      testedAt,
      checks: [
        {
          code: "CONNECTION_SUCCESS",
          level: "pass",
          message: `CLIProxyAPI reachable at ${baseUrl}`,
          detail: `Found ${data.data?.length ?? 0} active models.`
        }
      ]
    };
  } catch (error) {
    return {
      adapterType: "cliproxyapi",
      status: "fail",
      testedAt,
      checks: [
        {
          code: "CONNECTION_FAILED",
          level: "fail",
          message: `CLIProxyAPI is not reachable at ${baseUrl}`,
          detail: error instanceof Error ? error.message : String(error),
          hint: "Ensure CLIProxyAPI is running locally on port 8317."
        }
      ]
    };
  }
}
