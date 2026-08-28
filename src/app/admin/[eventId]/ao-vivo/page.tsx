"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { VOTE_CRITERIA } from "@/lib/criteria";
import type { LiveVotingState } from "@/lib/server/live-voting";

function formatScore(score: number) {
  return score.toFixed(1).replace(".", ",");
}

export default function AdminLiveVotingPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [state, setState] = useState<LiveVotingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${eventId}/live`);
    if (!res.ok) {
      setError("Não foi possível carregar. Faça login novamente.");
      return;
    }
    setState(await res.json());
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial de dados no mount
    refresh();
  }, [refresh]);

  const currentPresentationId = state?.currentPresentation?.presentationId ?? null;

  // Reage à troca de apresentação (o admin inicia/encerra outro participante).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`admin-live-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presentations", filter: `event_id=eq.${eventId}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, refresh]);

  // Reage a cada voto confirmado na apresentação atual (vote_receipts nunca
  // expõe a nota — só dispara o refetch autenticado que traz os critérios).
  useEffect(() => {
    if (!currentPresentationId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`admin-live-votes-${currentPresentationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vote_receipts",
          filter: `presentation_id=eq.${currentPresentationId}`,
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPresentationId, refresh]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-700">{error}</p>
        <Link href="/admin/login" className="text-sm font-medium underline">
          Ir para o login
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-blue-dark">Votação ao vivo</h1>
        <Link href={`/admin/${eventId}`} className="text-sm font-medium text-brand-blue underline">
          Voltar ao painel
        </Link>
      </header>

      {!state.currentPresentation ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 p-10 text-center">
          <p className="text-base text-zinc-600">
            Nenhuma apresentação em andamento no momento.
          </p>
          <p className="text-sm text-zinc-400">
            Esta tela atualiza sozinha assim que o admin iniciar a próxima apresentação.
          </p>
        </section>
      ) : (
        <>
          <section className="flex flex-col items-center gap-6 rounded-2xl border border-brand-blue/30 bg-brand-blue/5 p-8 text-center">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">Apresentando agora</p>
              <h2 className="text-3xl font-bold text-brand-blue-dark">
                {state.currentPresentation.participantName}
              </h2>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Média parcial</p>
              <p className="text-6xl font-bold tabular-nums text-brand-blue-dark">
                {state.partialAverage != null ? formatScore(state.partialAverage) : "—"}
              </p>
              <p className="text-xs text-zinc-400">
                {state.judges.filter((j) => j.voted).length} de {state.judges.length} jurados votaram
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            {state.judges.map((judge) => (
              <div
                key={judge.judgeId}
                className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
                  judge.voted ? "border-brand-blue/40 bg-white" : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-brand-blue-dark">{judge.judgeName}</span>
                  {judge.voted && judge.finalScore != null ? (
                    <span className="text-xl font-bold tabular-nums text-brand-blue-dark">
                      {formatScore(judge.finalScore)}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-400">Aguardando</span>
                  )}
                </div>
                {judge.scores && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 sm:grid-cols-3">
                    {VOTE_CRITERIA.map((criterion) => (
                      <div key={criterion.key} className="flex flex-col">
                        <span className="text-xs text-zinc-500">{criterion.label}</span>
                        <span className="text-sm font-medium text-zinc-700">
                          {formatScore(judge.scores![criterion.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
