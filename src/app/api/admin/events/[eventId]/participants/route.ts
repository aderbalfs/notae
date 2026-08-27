import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  names: z
    .array(z.string().trim().min(1))
    .min(1, "Informe ao menos um participante"),
});

/**
 * Substitui a lista completa de participantes do evento pela lista enviada,
 * na ordem em que os nomes aparecem. Recria as apresentações (1 por
 * participante). Só permitido enquanto o evento está em 'draft' — depois
 * que a votação começa, mexer na lista invalidaria apresentações em curso.
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
      { error: "Não é possível editar participantes após o evento ser iniciado" },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabase
    .from("participants")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) {
    return NextResponse.json({ error: "Falha ao limpar participantes atuais" }, { status: 500 });
  }

  const rows = parsed.data.names.map((name, index) => ({
    event_id: eventId,
    name,
    display_order: index + 1,
  }));

  const { data: participants, error: insertError } = await supabase
    .from("participants")
    .insert(rows)
    .select("id, name, display_order")
    .order("display_order", { ascending: true });

  if (insertError || !participants) {
    return NextResponse.json({ error: "Falha ao salvar participantes" }, { status: 500 });
  }

  const presentationRows = participants.map((p) => ({
    event_id: eventId,
    participant_id: p.id,
    status: "aguardando" as const,
  }));

  const { error: presentationsError } = await supabase
    .from("presentations")
    .insert(presentationRows);

  if (presentationsError) {
    return NextResponse.json({ error: "Falha ao preparar apresentações" }, { status: 500 });
  }

  await logAction({
    eventId,
    actorType: "admin",
    action: "participants.batch_set",
    details: { count: participants.length },
  });

  return NextResponse.json({ participants });
}
