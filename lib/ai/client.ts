// ─── OpenAI client ────────────────────────────────────────────────────────────
//
// Server-side only. OPENAI_API_KEY is never exposed to the browser, so every
// call goes through a route handler under app/api.
//
// AI is optional throughout Taskora: without a key the app keeps working,
// the feature simply does not offer itself. Callers check `isAiEnabled()`
// before reaching for `getOpenAI()`.

import OpenAI from "openai";

/** The vision model used for proof capture. Override with OPENAI_MODEL. */
export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

let client: OpenAI | null = null;

export function isAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  // The client is stateless — reuse it so we keep one connection pool per
  // server instance instead of building a new one on every request.
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
