const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: toNumber(process.env.AI_PORT, 8787),
  provider: process.env.AI_PROVIDER || "ollama",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen2.5:3b-instruct",
  ollamaTimeoutMs: toNumber(process.env.OLLAMA_TIMEOUT_MS, 120000),
  allowedOrigin: process.env.AI_ALLOWED_ORIGIN || "http://localhost:8080",
  rateLimitWindowMs: toNumber(process.env.AI_RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMax: toNumber(process.env.AI_RATE_LIMIT_MAX, 30),
};
