"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Participant {
  id: string;
  name: string;
  display_order: number;
}

interface Judge {
  id: string;
  name: string;
  access_token: string;
}

type PresentationStatus = "aguardando" | "em_andamento" | "encerrada";

interface Presentation {
  id: string;
  participant_id: string;
  status: PresentationStatus;
}

interface EventOverview {
  event: { id: string; name: string; status: string; current_presentation_id: string | null };
  participants: Participant[];
  judges: Judge[];
  presentations: Presentation[];
}

export default function AdminEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<EventOverview | null>(null);
  const [participantsText, setParticipantsText] = useState("");
  const [judgesText, setJudgesText] = useState("");
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [savingJudges, setSavingJudges] = useState(false);
  const [presentationActionId, setPresentationActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [votedJudgeIds, setVotedJudgeIds] = useState<Set<string>>(new Set());
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const currentPresentationId =
    data?.presentations.find((p) => p.status === "em_andamento")?.id ?? null;

  const loadOverview = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${eventId}`);
    if (!res.ok) {
      setError("Não foi possível carregar o evento. Faça login novamente.");
      return;
    }
    const body: EventOverview = await res.json();
    setData(body);
    setParticipantsText(body.participants.map((p) => p.name).join("\n"));
    setJudgesText(body.judges.map((j) => j.name).join("\n"));
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial de dados no mount
    loadOverview();
  }, [loadOverview]);

  // Acompanha ao vivo quais jurados já votaram na apresentação em andamento,
  // via Realtime em vote_receipts (nunca expõe a nota, só o "já votou").
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o estado ao trocar de apresentação
    setVotedJudgeIds(new Set());
    if (!currentPresentationId) return;

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase
      .from("vote_receipts")
      .select("judge_id")
      .eq("presentation_id", currentPresentationId)
      .then(({ data: receipts }) => {
        if (!cancelled && receipts) {
          setVotedJudgeIds(new Set(receipts.map((r) => r.judge_id)));
        }
      });

    const channel = supabase
      .channel(`admin-votes-${currentPresentationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vote_receipts",
          filter: `presentation_id=eq.${currentPresentationId}`,
        },
        (payload) => {
          const judgeId = (payload.new as { judge_id?: string } | null)?.judge_id;
          if (judgeId) {
            setVotedJudgeIds((prev) => new Set(prev).add(judgeId));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentPresentationId]);

  async function saveParticipants() {
    setError(null);
    setSavingParticipants(true);
    try {
      const names = participantsText.split("\n").map((n) => n.trim()).filter(Boolean);
      const res = await fetch(`/api/admin/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Falha ao salvar participantes.");
        return;
      }
      await loadOverview();
    } finally {
      setSavingParticipants(false);
    }
  }

  async function saveJudges() {
    setError(null);
    setSavingJudges(true);
    try {
      const names = judgesText.split("\n").map((n) => n.trim()).filter(Boolean);
      const res = await fetch(`/api/admin/events/${eventId}/judges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Falha ao salvar jurados.");
        return;
      }
      await loadOverview();
    } finally {
      setSavingJudges(false);
    }
  }

  async function runPresentationAction(presentationId: string, action: "start" | "close" | "reopen") {
    setError(null);
    setPresentationActionId(presentationId);
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/presentations/${presentationId}/${action}`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Falha ao atualizar apresentação.");
        return;
      }
      await loadOverview();
    } finally {
      setPresentationActionId(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
    } finally {
      setLoggingOut(false);
    }
  }

  if (error && !data) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-700">{error}</p>
        <Link href="/admin/login" className="text-sm font-medium underline">
          Ir para o login
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </main>
    );
  }

  const isDraft = data.event.status === "draft";
  const presentationByParticipant = new Map(data.presentations.map((p) => [p.participant_id, p]));
  const hasOngoing = data.presentations.some((p) => p.status === "em_andamento");
  const currentPresentation = data.presentations.find((p) => p.id === currentPresentationId);
  const currentParticipant = currentPresentation
    ? data.participants.find((p) => p.id === currentPresentation.participant_id)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue-dark">{data.event.name}</h1>
          <p className="text-sm text-zinc-500">Status: {data.event.status}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={`/admin/${eventId}/resultados`}
            className="text-sm font-medium text-brand-blue underline"
          >
            Ver apuração
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm font-medium text-zinc-500 underline disabled:opacity-50"
          >
            {loggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {currentPresentationId && data.judges.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-brand-blue/30 bg-brand-blue/5 p-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-blue-dark">Votação ao vivo</h2>
            {currentParticipant && (
              <p className="text-sm text-zinc-600">
                Apresentando agora: <strong>{currentParticipant.name}</strong>
              </p>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {data.judges.map((judge) => {
              const voted = votedJudgeIds.has(judge.id);
              return (
                <li
                  key={judge.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="text-zinc-700">{judge.name}</span>
                  <span
                    className={
                      voted
                        ? "font-medium text-brand-blue-dark"
                        : "text-zinc-400"
                    }
                  >
                    {voted ? "Votou" : "Aguardando"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-zinc-500">
            {votedJudgeIds.size} de {data.judges.length} jurados votaram
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-brand-blue-dark">
          Participantes ({data.participants.length})
        </h2>
        <p className="text-sm text-zinc-500">
          Um nome por linha. A ordem de apresentação segue a ordem das linhas.
        </p>
        <textarea
          className="min-h-40 rounded-lg border border-zinc-300 p-3 font-mono text-sm focus:border-brand-blue focus:outline-none"
          value={participantsText}
          onChange={(e) => setParticipantsText(e.target.value)}
          disabled={!isDraft}
          placeholder={"João Silva\nMaria Souza\n..."}
        />
        <button
          onClick={saveParticipants}
          disabled={!isDraft || savingParticipants}
          className="h-11 rounded-full bg-brand-blue-dark text-sm font-medium text-white disabled:opacity-50"
        >
          {savingParticipants ? "Salvando..." : "Salvar participantes"}
        </button>
      </section>

      {data.participants.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-brand-blue-dark">Apresentações</h2>
          <p className="text-sm text-zinc-500">
            Inicie a apresentação de um participante para liberar a votação dos
            jurados. Encerre para travar as notas.
          </p>
          <ul className="flex flex-col gap-2">
            {data.participants.map((participant) => {
              const presentation = presentationByParticipant.get(participant.id);
              const status = presentation?.status ?? "aguardando";
              const isBusy = presentationActionId === presentation?.id;
              return (
                <li
                  key={participant.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-brand-blue-dark">
                      {participant.display_order}. {participant.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {status === "aguardando" && "Aguardando"}
                      {status === "em_andamento" && "Em andamento"}
                      {status === "encerrada" && "Encerrada"}
                    </p>
                  </div>
                  {presentation && (
                    <div className="flex gap-2">
                      {status === "aguardando" && (
                        <button
                          onClick={() => runPresentationAction(presentation.id, "start")}
                          disabled={isBusy || hasOngoing}
                          className="h-9 rounded-full bg-brand-blue-dark px-4 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Iniciar
                        </button>
                      )}
                      {status === "em_andamento" && (
                        <button
                          onClick={() => runPresentationAction(presentation.id, "close")}
                          disabled={isBusy}
                          className="h-9 rounded-full bg-brand-orange px-4 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Encerrar
                        </button>
                      )}
                      {status === "encerrada" && (
                        <button
                          onClick={() => runPresentationAction(presentation.id, "reopen")}
                          disabled={isBusy || hasOngoing}
                          className="h-9 rounded-full border border-zinc-300 px-4 text-xs font-medium text-brand-blue-dark disabled:opacity-50"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-brand-blue-dark">
          Jurados ({data.judges.length})
        </h2>
        <p className="text-sm text-zinc-500">Um nome por linha.</p>
        <textarea
          className="min-h-32 rounded-lg border border-zinc-300 p-3 font-mono text-sm focus:border-brand-blue focus:outline-none"
          value={judgesText}
          onChange={(e) => setJudgesText(e.target.value)}
          disabled={!isDraft}
          placeholder={"Jurado 1\nJurado 2\n..."}
        />
        <button
          onClick={saveJudges}
          disabled={!isDraft || savingJudges}
          className="h-11 rounded-full bg-brand-blue-dark text-sm font-medium text-white disabled:opacity-50"
        >
          {savingJudges ? "Salvando..." : "Salvar jurados"}
        </button>

        {data.judges.length > 0 && (
          <ul className="flex flex-col gap-2 pt-2">
            {data.judges.map((judge) => (
              <li
                key={judge.id}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 text-sm"
              >
                <span className="font-medium text-brand-blue-dark">{judge.name}</span>
                <code className="break-all text-xs text-zinc-500">
                  {origin}/j/{judge.access_token}
                </code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
