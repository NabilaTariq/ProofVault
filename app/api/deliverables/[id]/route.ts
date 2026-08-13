import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "@/lib/storage";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  // Payment status. Recording when it flipped gives the dispute assistant a
  // real payment history instead of a bare boolean.
  if (typeof body.paid === "boolean") {
    update.paid = body.paid;
    update.paid_at = body.paid ? new Date().toISOString() : null;
  }

  // Client acknowledgement / approval of the delivery.
  if (typeof body.acknowledged === "boolean") {
    update.acknowledged = body.acknowledged;
    update.acknowledged_at = body.acknowledged ? new Date().toISOString() : null;
    if (!body.acknowledged) update.acknowledgement_note = null;
  }

  if (typeof body.acknowledgement_note === "string") {
    update.acknowledgement_note = body.acknowledgement_note.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // `.select()` matters: without it an update that matches zero rows — a row
  // owned by another account, or one hidden by RLS — comes back with no error,
  // so the client would report success while nothing changed.
  const { data, error } = await supabase
    .from("deliverables")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Deliverable not found, or it belongs to another account." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("deliverables")
    .select("file_key")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  const { data: deleted, error } = await supabase
    .from("deliverables")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Same reasoning as PATCH — a no-op delete must not report success.
  if (!deleted) {
    return NextResponse.json(
      { error: "Deliverable not found, or it belongs to another account." },
      { status: 404 }
    );
  }

  if (existing?.file_key) {
    try {
      await supabase.storage.from(PROOF_BUCKET).remove([existing.file_key]);
    } catch {
      // The DB row is gone either way; a stray stored object can be cleaned
      // up later and shouldn't block the user-facing delete.
    }
  }

  return NextResponse.json({ ok: true });
}
