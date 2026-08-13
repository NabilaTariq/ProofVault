import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { AI_MODEL, getOpenAI, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  PROOF_CAPTURE_SCHEMA,
  PROOF_CAPTURE_SYSTEM_PROMPT,
  isProofSuggestion,
  sanitizeSuggestion,
  type ProofCaptureResult,
} from "@/lib/ai/proof-capture";

export const dynamic = "force-dynamic";

// ─── Limits ───────────────────────────────────────────────────────────────────

/** Decoded image ceiling. The browser downscales first, so this is a backstop
 *  against a hand-rolled request, and keeps us under the ~4.5 MB body limit
 *  serverless hosts apply. */
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Analyses per user per hour. Each one is a paid vision call. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// ─── Data URL parsing ─────────────────────────────────────────────────────────

interface ParsedDataUrl {
  mediaType: string;
  bytes: number;
}

/** Validate the shape and size of a `data:image/...;base64,...` URL. */
function parseImageDataUrl(value: string): ParsedDataUrl | { error: string } {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/i.exec(value);
  if (!match) {
    return { error: "The image must be a base64 data URL." };
  }

  const [, mediaType, base64] = match;

  if (!ALLOWED_MEDIA_TYPES.includes(mediaType.toLowerCase())) {
    return { error: "Only PNG, JPEG, WebP and GIF images can be analyzed." };
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = (base64.length * 3) / 4 - padding;

  if (bytes <= 0) return { error: "The image appears to be empty." };
  if (bytes > MAX_IMAGE_BYTES) {
    return { error: "The image is too large to analyze. Try a smaller screenshot." };
  }

  return { mediaType: mediaType.toLowerCase(), bytes };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!isAiEnabled()) {
    return NextResponse.json(
      { success: false, error: "Proof capture is not configured on this deployment." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!imageDataUrl) {
    return NextResponse.json({ success: false, error: "An image is required" }, { status: 400 });
  }

  const parsed = parseImageDataUrl(imageDataUrl);
  if ("error" in parsed) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  // Charge the allowance only once the request is known to be well-formed, so
  // malformed retries cannot burn a user's quota.
  const limit = checkRateLimit(user.id, "proof-capture", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `You've reached the analysis limit for this hour. Try again in ${Math.ceil(
          limit.retryAfter / 60
        )} minute(s), or fill the form in manually.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  // ── Vision call ────────────────────────────────────────────────────────────
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 1500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "proof_suggestion",
          strict: true,
          schema: PROOF_CAPTURE_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [
        { role: "system", content: PROOF_CAPTURE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Read this proof file and draft the ledger entry it supports. Report only what is visible in the image.",
            },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
          ],
        },
      ],
    });

    const choice = completion.choices[0];

    if (choice?.message?.refusal) {
      return NextResponse.json(
        { success: false, error: "The model declined to read this file. Please fill the form in manually." },
        { status: 422 }
      );
    }

    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        { success: false, error: "The analysis was cut short. Please try again or fill the form in manually." },
        { status: 502 }
      );
    }

    const text = choice?.message?.content?.trim();
    if (!text) {
      return NextResponse.json(
        { success: false, error: "The model returned an empty result." },
        { status: 502 }
      );
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: "The model returned a result in an unexpected format." },
        { status: 502 }
      );
    }

    if (!isProofSuggestion(candidate)) {
      return NextResponse.json(
        { success: false, error: "The model returned a result in an unexpected shape." },
        { status: 502 }
      );
    }

    const result: ProofCaptureResult = {
      suggestion: sanitizeSuggestion(candidate),
      model: completion.model,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // Log server-side; never leak provider detail (or key state) to the browser.
    console.error("Proof capture failed:", error);

    if (error instanceof OpenAI.APIError) {
      // A 429 is two very different problems wearing the same status code.
      // `insufficient_quota` means the account has no credit — retrying never
      // clears it, so say so rather than inviting the user to try again.
      if (error.status === 429) {
        const outOfCredit =
          error.code === "insufficient_quota" || error.type === "insufficient_quota";

        return NextResponse.json(
          {
            success: false,
            error: outOfCredit
              ? "Proof capture is unavailable: the OpenAI account behind this deployment has no remaining credit."
              : "The AI service is rate-limiting requests right now. Please try again in a moment.",
          },
          { status: 503 }
        );
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "Proof capture is not configured correctly on this deployment — the API key was rejected.",
          },
          { status: 503 }
        );
      }
      if (error.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: `The configured model (${AI_MODEL}) is not available to this API key.`,
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Could not analyze this file. Please fill the form in manually." },
      { status: 502 }
    );
  }
}
