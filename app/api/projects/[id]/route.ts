import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "@/lib/storage";

const ALLOWED_STATUSES = ["active", "completed", "archived"] as const;
const ALLOWED_CURRENCIES = ["USD", "GBP", "EUR", "PKR", "INR", "AED", "CAD", "AUD"] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // Parse body safely
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  // Ownership check — only allow updating this user's own project
  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  // Build the update object from only allowed fields
  const update: Record<string, unknown> = {};

  if (typeof body.client_name === "string") {
    const name = body.client_name.trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Client name cannot be empty" }, { status: 400 });
    }
    update.client_name = name;
  }

  if (typeof body.platform === "string") {
    update.platform = body.platform.trim() || null;
  }

  if (typeof body.description === "string") {
    update.description = body.description.trim() || null;
  }

  if (body.agreed_amount !== undefined) {
    const amount = parseFloat(String(body.agreed_amount));
    if (isNaN(amount) || amount < 0) {
      return NextResponse.json({ success: false, error: "Invalid agreed amount" }, { status: 400 });
    }
    update.agreed_amount = amount;
  }

  if (typeof body.currency === "string") {
    const currency = body.currency.toUpperCase();
    if (!ALLOWED_CURRENCIES.includes(currency as typeof ALLOWED_CURRENCIES[number])) {
      return NextResponse.json({ success: false, error: `Unsupported currency: ${currency}` }, { status: 400 });
    }
    update.currency = currency;
  }

  if (typeof body.status === "string") {
    if (!ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
      return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Project update error:", error);
    return NextResponse.json({ success: false, error: "Could not update project. Please try again." }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // Deliverable rows cascade with the project (schema.sql: project_id ... on
  // delete cascade), but the proof files they point at live in Storage and do
  // not. Read the keys before the cascade removes the rows that name them —
  // afterwards there is nothing left to look them up by.
  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("file_key")
    .eq("project_id", params.id)
    .eq("user_id", user.id);

  // `.select()` matters here for the same reason it does on PATCH: a delete
  // matching zero rows — someone else's project, or one hidden by RLS — comes
  // back without an error, so we would report success having deleted nothing.
  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Project delete error:", error);
    return NextResponse.json(
      { success: false, error: "Could not delete project. Please try again." },
      { status: 400 }
    );
  }

  if (!deleted) {
    return NextResponse.json(
      { success: false, error: "Project not found, or it belongs to another account." },
      { status: 404 }
    );
  }

  const fileKeys = (deliverables ?? [])
    .map((d) => d.file_key)
    .filter((key): key is string => Boolean(key));

  if (fileKeys.length > 0) {
    try {
      await supabase.storage.from(PROOF_BUCKET).remove(fileKeys);
    } catch {
      // The project is gone either way; stray stored objects can be cleaned up
      // later and shouldn't fail a delete the user already saw succeed.
    }
  }

  return NextResponse.json({ success: true });
}
