import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Nome do evento é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

/**
 * Cria o evento e, junto, a única credencial (e-mail + senha) que poderá
 * administrá-lo. Esta é a única rota do sistema que cria contas no Supabase
 * Auth — feito com a service role (auth.admin.createUser), sem passar pelo
 * signUp público. Não existe nenhuma outra forma de se cadastrar.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const supabase = createSupabaseServiceClient();

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
    action: "event.created",
    details: { name },
  });

  return NextResponse.json({ eventId: event.id });
}
