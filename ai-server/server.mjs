import http from "node:http";
import { config } from "./config.mjs";
import { OllamaProvider } from "./providers/ollama.mjs";

const provider = (() => {
  if (config.provider === "ollama") {
    return new OllamaProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      timeoutMs: config.ollamaTimeoutMs,
    });
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
})();

const rateState = new Map();

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": config.allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body));
};

const parseBody = async (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const sanitizeText = (v, max = 120) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
const sanitizeItems = (arr, max = 20) =>
  (Array.isArray(arr) ? arr : []).slice(0, max).map((item) => ({
    name: sanitizeText(item?.name, 80),
    quantity: toNumber(item?.quantity, 0),
    threshold: toNumber(item?.threshold, 0),
    category: sanitizeText(item?.category, 40),
  }));

const validateInsightsPayload = (payload) => {
  if (!isObject(payload)) throw new Error("Payload must be an object");
  const metricsRaw = isObject(payload.metrics) ? payload.metrics : {};
  const businessRaw = isObject(payload.businessProfile) ? payload.businessProfile : {};
  return {
    metrics: {
      todaySales: toNumber(metricsRaw.todaySales),
      todayProfit: toNumber(metricsRaw.todayProfit),
      totalStockValue: toNumber(metricsRaw.totalStockValue),
      lowStockCount: toNumber(metricsRaw.lowStockCount),
      totalCreditOwed: toNumber(metricsRaw.totalCreditOwed),
      totalExpenses: toNumber(metricsRaw.totalExpenses),
    },
    businessProfile: {
      category: sanitizeText(businessRaw.category, 40) || "retail",
      offeringMode: sanitizeText(businessRaw.offeringMode, 20) || "products",
      singleOffering: Boolean(businessRaw.singleOffering),
    },
    lowStockProducts: sanitizeItems(payload.lowStockProducts),
    topProducts: sanitizeItems(payload.topProducts, 20),
  };
};

const validateQueryPayload = (payload) => {
  if (!isObject(payload)) throw new Error("Payload must be an object");
  const question = sanitizeText(payload.question, 300);
  if (!question) throw new Error("question is required");
  return {
    question,
    context: isObject(payload.context) ? payload.context : {},
  };
};

const isRateLimited = (req) => {
  const key = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .toString()
    .split(",")[0]
    .trim();
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const max = config.rateLimitMax;
  const record = rateState.get(key);

  if (!record || now > record.resetAt) {
    rateState.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  record.count += 1;
  if (record.count > max) return true;
  return false;
};

const buildInsightsPrompt = (payload) => {
  const metrics = payload.metrics || {};
  const lowStock = payload.lowStockProducts || [];
  const topProducts = payload.topProducts || [];
  const businessProfile = payload.businessProfile || {};
  const mode = businessProfile.offeringMode || "products";

  return [
    "You are an assistant for a small Kenyan small-business owner.",
    "Return concise, practical advice in plain text.",
    `Business category: ${businessProfile.category || "retail"}`,
    `Offering mode: ${mode}`,
    `Single main offering: ${businessProfile.singleOffering ? "yes" : "no"}`,
    "Use this data:",
    `- Today sales (KES): ${toNumber(metrics.todaySales)}`,
    `- Today profit (KES): ${toNumber(metrics.todayProfit)}`,
    `- Total stock value (KES): ${toNumber(metrics.totalStockValue)}`,
    `- Low stock count: ${toNumber(metrics.lowStockCount)}`,
    `- Total credit owed (KES): ${toNumber(metrics.totalCreditOwed)}`,
    `- Total expenses (KES): ${toNumber(metrics.totalExpenses)}`,
    `- Low stock products: ${lowStock.map((p) => p.name).filter(Boolean).join(", ") || "none"}`,
    `- Top products by sales: ${topProducts.map((p) => p.name).filter(Boolean).join(", ") || "none"}`,
    mode === "services" ? "- For services, focus on capacity, staffing, booking, and consumables." : "- For products, focus on stock, pricing, and reorder urgency.",
    "Output format:",
    "1) One-paragraph summary",
    "2) Three action items",
    "3) One warning risk",
  ].join("\n");
};

const buildReorderPrompt = (payload) => {
  const lowStock = payload.lowStockProducts || [];
  const topProducts = payload.topProducts || [];
  const businessProfile = payload.businessProfile || {};
  const mode = businessProfile.offeringMode || "products";

  return [
    "You are advising a Kenyan micro/small business owner.",
    `Business category: ${businessProfile.category || "retail"}`,
    `Offering mode: ${mode}`,
    `Single main offering: ${businessProfile.singleOffering ? "yes" : "no"}`,
    `Low stock products JSON: ${JSON.stringify(lowStock.slice(0, 20))}`,
    `Top products JSON: ${JSON.stringify(topProducts.slice(0, 20))}`,
    "Task:",
    mode === "services"
      ? "Create a 7-day resource and capacity plan (staff time, key consumables, and booking priorities)."
      : "Create a 7-day reorder plan prioritizing products likely to stock out.",
    "Output format:",
    "1) Priority list (max 5 items) with short reason",
    "2) Suggested action for each item",
    "3) One cashflow caution",
  ].join("\n");
};

const buildQueryPrompt = ({ question, context }) => [
  "You are a careful retail operations assistant for Duka Manager.",
  "Answer only from the provided context.",
  "If context is not enough, say exactly: 'I need more data from your records.'",
  `Question: ${question}`,
  `Context JSON: ${JSON.stringify(context || {})}`,
  "Keep answer under 120 words.",
].join("\n");

const statusForError = (err) => {
  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("timeout")) return 504;
  if (msg.includes("rate limit")) return 429;
  return 400;
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": config.allowedOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, {
      ok: true,
      provider: config.provider,
      model: config.ollamaModel,
      timeoutMs: config.ollamaTimeoutMs,
      rateLimitMax: config.rateLimitMax,
      rateLimitWindowMs: config.rateLimitWindowMs,
    });
  }

  if (req.method === "POST" && req.url?.startsWith("/ai/")) {
    if (isRateLimited(req)) {
      return sendJson(res, 429, { ok: false, error: "Rate limit exceeded" });
    }
  }

  if (req.method === "POST" && req.url === "/ai/insights") {
    try {
      const payload = validateInsightsPayload(await parseBody(req));
      const prompt = buildInsightsPrompt(payload);
      const answer = await provider.generate({ prompt });
      return sendJson(res, 200, { ok: true, answer });
    } catch (err) {
      return sendJson(res, statusForError(err), { ok: false, error: err.message || "Bad request" });
    }
  }

  if (req.method === "POST" && req.url === "/ai/reorder") {
    try {
      const payload = validateInsightsPayload(await parseBody(req));
      const prompt = buildReorderPrompt(payload);
      const answer = await provider.generate({ prompt });
      return sendJson(res, 200, { ok: true, answer });
    } catch (err) {
      return sendJson(res, statusForError(err), { ok: false, error: err.message || "Bad request" });
    }
  }

  if (req.method === "POST" && req.url === "/ai/query") {
    try {
      const payload = validateQueryPayload(await parseBody(req));
      const prompt = buildQueryPrompt(payload);
      const answer = await provider.generate({ prompt });
      return sendJson(res, 200, { ok: true, answer });
    } catch (err) {
      return sendJson(res, statusForError(err), { ok: false, error: err.message || "Bad request" });
    }
  }

  return sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(config.port, () => {
  console.log(`[ai-server] listening on http://localhost:${config.port}`);
});
