export const type = "cliproxyapi";

export const models = [
  {
    id: "agy-3.1-pro-high",
    label: "Antigravity 3.1 Pro High",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.1-pro-low",
    label: "Antigravity 3.1 Pro Low",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.0-pro-high",
    label: "Antigravity 3.0 Pro High",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.0-pro-low",
    label: "Antigravity 3.0 Pro Low",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.5-flash-high",
    label: "Antigravity 3.5 Flash High",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.5-flash-low",
    label: "Antigravity 3.5 Flash Low",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.1-flash-lite",
    label: "Antigravity 3.1 Flash Lite",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.1-flash-image",
    label: "Antigravity 3.1 Flash Image",
    provider: "cliproxyapi",
  },
  {
    id: "agy-3.0-flash",
    label: "Antigravity 3.0 Flash",
    provider: "cliproxyapi",
  },

  {
    id: "claude-opus-4-6-thinking",
    label: "Claude Opus 4.6 Thinking",
    provider: "cliproxyapi",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "cliproxyapi",
  },

  {
    id: "gpt-oss-120b-medium",
    label: "GPT OSS 120B Medium",
    provider: "cliproxyapi",
  },

  {
    id: "gem-3.1-pro",
    label: "Gemini 3.1 Pro",
    provider: "cliproxyapi",
  },
  {
    id: "gem-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    provider: "cliproxyapi",
  },
  {
    id: "gem-3.0-pro",
    label: "Gemini 3.0 Pro",
    provider: "cliproxyapi",
  },
  {
    id: "gem-3.0-flash",
    label: "Gemini 3.0 Flash",
    provider: "cliproxyapi",
  },
  {
    id: "gem-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "cliproxyapi",
  },
  {
    id: "gem-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "cliproxyapi",
  },
  {
    id: "gem-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "cliproxyapi",
  },
];

export const agentConfigurationDoc = `
CLIProxyAPI adapter.

Default endpoint:
http://127.0.0.1:8317/v1
`;

export { createServerAdapter } from "./server/index.js";
