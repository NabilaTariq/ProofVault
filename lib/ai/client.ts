// ─── OpenRouter client ────────────────────────────────────────────────────────
//
// OpenRouter speaks the OpenAI wire protocol, so we keep the `openai` SDK and
// just point it at OpenRouter's base URL. Model ids are namespaced by provider
// (`openai/gpt-4o`, `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-pro`, …).
//
// Server-side only. OPENROUTER_API_KEY is never exposed to the browser, so every
// call goes through a route handler under app/api.
//
// AI is optional throughout Taskora: without a key the app keeps working,
// the feature simply does not offer itself. Callers check `isAiEnabled()`
// before reaching for `getOpenRouter()`.

import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** The vision model used for proof capture. Override with OPENROUTER_MODEL.
 *  Must support vision + strict structured outputs. */
export const AI_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

let client: OpenAI | null = null;

export function isAiEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getOpenRouter(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }
  // The client is stateless — reuse it so we keep one connection pool per
  // server instance instead of building a new one on every request.
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      // Optional attribution headers — they place the app on OpenRouter's
      // leaderboards and are ignored when unset.
      defaultHeaders: {
        ...(process.env.OPENROUTER_SITE_URL
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
          : {}),
        "X-Title": process.env.OPENROUTER_SITE_NAME || "Taskora",
      },
    });
  }
  return client;
}
