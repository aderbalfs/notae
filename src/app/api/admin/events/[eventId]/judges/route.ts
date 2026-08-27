import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  names: z.array(z.string().trim().min(1)).min(1, "Informe ao menos um jurado"),
});

/**
 * Substitui a lista completa de jurados do evento. Só permitido em 'draft':
 * apagar um jurado depois que a votação começou apagaria em cascata os
 * votos já registrados por ele.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("status")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  if (event.status !== "draft") {
    return NextResponse.json(
      { error: "Não é possível editar jurados após o evento ser iniciado" },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabase.from("judges").delete().eq("event_id", eventId);
  if (deleteError) {
    return NextResponse.json({ error: "Falha ao limpar jurados atuais" }, { status: 500 });
  }

  const rows = parsed.data.names.map((name) => ({ event_id: eventId, name }));

  const { data: judges, error: insertError } = await supabase
    .from("judges")
    .insert(rows)
    .select("id, name, access_token");

  if (insertError || !judges) {
    return NextResponse.json({ error: "Falha ao salvar jurados" }, { status: 500 });
  }

  await logAction({
    eventId,
    actorType: "admin",
    action: "judges.batch_set",
    details: { count: judges.length },
  });

  return NextResponse.json({ judges });
}
