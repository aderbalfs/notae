import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAuthClient } from "@/lib/supabase/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

const bodySchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

/**
 * Autentica o admin (e-mail + senha, via Supabase Auth) e abre uma sessão
 * própria para a conta — não para um evento específico, já que um admin
 * pode ser dono de vários eventos.
 */
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

  const token = createAdminSessionToken(signInData.user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
