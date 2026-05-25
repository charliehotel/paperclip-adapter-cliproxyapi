import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";

export function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "baseUrl",
        label: "Base URL",
        type: "text",
        default: "http://127.0.0.1:8317/v1",
        required: true,
        hint: "The connection endpoint for CLIProxyAPI.",
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "text",
        default: "paperclip-local",
        required: true,
        hint: "Authentication token for the CLIProxyAPI endpoint.",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "number",
        default: 0.2,
        hint: "Sampling temperature for model generation (0.0 to 1.0).",
      },
    ],
  };
}
