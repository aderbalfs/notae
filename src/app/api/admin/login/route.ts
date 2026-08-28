import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAuthClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/server/admin-session";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const authClient = createSupabaseAuthClient();
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("admin_user_id", signInData.user.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  const token = createAdminSessionToken(event.id);
  const response = NextResponse.json({ ok: true, eventId: event.id });
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
