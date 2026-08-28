import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/server/audit";
import { requireAdminUserId } from "@/lib/server/require-admin";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

const newAccountSchema = z.object({
  name: z.string().trim().min(1, "Nome do evento é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

const additionalEventSchema = z.object({
  name: z.string().trim().min(1, "Nome do evento é obrigatório"),
});

/** Lista os eventos do admin autenticado — usado pela tela "Meus eventos". */
export async function GET() {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, created_at")
    .eq("admin_user_id", adminUserId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ events: events ?? [] });
}

/**
 * Cria um evento. Dois modos, na mesma rota:
 *  - já logado: só precisa do nome — o evento é atribuído ao admin da
 *    sessão. É como o admin cria eventos extras (ex.: para testar cenários
 *    antes da apresentação real) sem precisar de nova credencial.
 *  - sem sessão: precisa de nome + e-mail + senha — cria a credencial no
 *    Supabase Auth (service role, nunca signUp público) e já loga o admin.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const supabase = createSupabaseServiceClient();

  let existingAdminUserId = await requireAdminUserId();

  if (existingAdminUserId) {
    // A sessão pode ser criptograficamente válida mas apontar para uma
    // conta que não existe mais (ex.: apagada manualmente no Supabase).
    // Sem essa checagem, o insert abaixo falharia com FK violation e um
    // 500 genérico e confuso — aqui tratamos como deslogado e seguimos
    // para o fluxo de criar conta nova (que já emite um cookie novo,
    // substituindo o antigo).
    const { data: authUser } = await supabase.auth.admin.getUserById(existingAdminUserId);
    if (!authUser?.user) {
      existingAdminUserId = null;
    }
  }

  if (existingAdminUserId) {
    const parsed = additionalEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
        { status: 400 }
      );
    }

    const { data: event, error } = await supabase
      .from("events")
      .insert({ name: parsed.data.name, admin_user_id: existingAdminUserId, status: "draft" })
      .select("id")
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Não foi possível criar o evento" }, { status: 500 });
    }

    await logAction({
      eventId: event.id,
      actorType: "admin",
      actorId: existingAdminUserId,
      action: "event.created",
      details: { name: parsed.data.name },
    });

    return NextResponse.json({ eventId: event.id });
  }

  const parsed = newAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const alreadyRegistered = authError?.status === 422 || authError?.status === 400;
    return NextResponse.json(
      { error: alreadyRegistered ? "Este e-mail já está em uso" : "Não foi possível criar a credencial do administrador" },
      { status: alreadyRegistered ? 409 : 500 }
    );
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({ name, admin_user_id: authData.user.id, status: "draft" })
    .select("id")
    .single();

  if (error || !event) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Não foi possível criar o evento" }, { status: 500 });
  }

  await logAction({
    eventId: event.id,
    actorType: "admin",
    actorId: authData.user.id,
    action: "event.created",
    details: { name },
  });

  const token = createAdminSessionToken(authData.user.id);
  const response = NextResponse.json({ eventId: event.id });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
