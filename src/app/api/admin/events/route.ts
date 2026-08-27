import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/server/pin";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Nome do evento é obrigatório"),
  pin: z.string().min(4, "PIN deve ter ao menos 4 caracteres"),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
      { status: 400 }
    );
  }
  const { name, pin } = parsed.data;

  const supabase = createSupabaseServiceClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({ name, admin_pin_hash: hashPin(pin), status: "draft" })
    .select("id")
    .single();

  if (error || !event) {
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
