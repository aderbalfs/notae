import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/server/pin";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/server/admin-session";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  pin: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const { eventId, pin } = parsed.data;

  const supabase = createSupabaseServiceClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, admin_pin_hash")
    .eq("id", eventId)
    .single();

  if (error || !event || !verifyPin(pin, event.admin_pin_hash)) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 401 });
  }

  const token = createAdminSessionToken(event.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  await logAction({ eventId: event.id, actorType: "admin", action: "admin.login" });

  return response;
}
