const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || "http://localhost:8787";

type AIResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
};

const request = async (path: string, payload: unknown): Promise<AIResponse> => {
  const res = await fetch(`${AI_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const aiClient = {
  insights: (payload: unknown) => request("/ai/insights", payload),
  reorder: (payload: unknown) => request("/ai/reorder", payload),
  query: (payload: { question: string; context?: unknown }) => request("/ai/query", payload),
  health: async () => {
    const res = await fetch(`${AI_BASE_URL}/health`);
    return res.json();
  },
};
