"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RankingBoard } from "@/components/ranking-board";
import {
  VOTE_CRITERIA,
  averageCriteriaScores,
  defaultCriteriaScores,
  type CriteriaScores,
  type CriterionKey,
} from "@/lib/criteria";
import type { JudgeState } from "@/lib/server/judge-state";

interface JudgeVotingScreenProps {
  token: string;
  initialState: JudgeState;
}

function formatScore(score: number) {
  return score.toFixed(1).replace(".", ",");
}

export function JudgeVotingScreen({ token, initialState }: JudgeVotingScreenProps) {
  const [state, setState] = useState<JudgeState>(initialState);
  const eventId = state.eventId;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/j/state?token=${token}`);
    if (!res.ok) return;
    const body: JudgeState = await res.json();
    setState(body);
  }, [token]);

  // Sincroniza a tela automaticamente quando o admin muda o participante
  // atual ou encerra/reabre a votação, sem exigir que o jurado recarregue.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`judge-${eventId}`)
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
      .subscribe((status, err) => console.log("[debug realtime]", status, err));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, refresh]);

  const locked = !state.current || state.current.status !== "em_andamento";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-6 py-10">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-blue">Jurado</p>
        <h1 className="text-xl font-bold text-brand-blue-dark">{state.judgeName}</h1>
      </header>

      {state.votingComplete ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold text-brand-blue-dark">
            Resultado final
          </h2>
          <RankingBoard ranking={state.ranking} />
        </section>
      ) : state.current ? (
        <section className="flex flex-col items-center gap-6 rounded-2xl border border-zinc-200 p-6">
          <div className="text-center">
            <p className="text-sm text-zinc-500">Apresentando agora</p>
            <h2 className="text-2xl font-bold text-brand-blue-dark">
              {state.current.participantName}
            </h2>
          </div>

          {locked ? (
            <p className="rounded-full bg-zinc-100 px-4 py-2 text-center text-sm text-zinc-600">
              Votação encerrada para este participante
              {state.current.myScore != null && (
                <>
                  {" "}
                  — sua nota: <strong>{formatScore(state.current.myScore)}</strong>
                </>
              )}
            </p>
          ) : (
            <ScoreEditor
              key={state.current.presentationId}
              token={token}
              presentationId={state.current.presentationId}
              initialScores={state.current.myScores ?? defaultCriteriaScores()}
              onSaved={refresh}
            />
          )}
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 p-6 text-center">
          <p className="text-base text-zinc-600">
            Aguardando o início da votação. A tela será atualizada automaticamente
            quando um participante entrar em apresentação.
          </p>
        </section>
      )}

      {state.history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-brand-blue-dark">Suas notas</h3>
          <ul className="flex flex-col gap-2">
            {state.history.map((item) => (
              <li
                key={item.presentationId}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <span className="text-zinc-700">{item.participantName}</span>
                <span className="font-semibold text-brand-blue-dark">
                  {item.score != null ? formatScore(item.score) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

interface ScoreEditorProps {
  token: string;
  presentationId: string;
  initialScores: CriteriaScores;
  onSaved: () => Promise<void>;
}

/**
 * Isolado em componente próprio e remontado via `key={presentationId}` pelo
 * pai: assim o estado da nota reseta ao trocar de participante sem precisar
 * de um efeito para sincronizar (o que causaria renders em cascata).
 */
function ScoreEditor({ token, presentationId, initialScores, onSaved }: ScoreEditorProps) {
  const [scores, setScores] = useState<CriteriaScores>(initialScores);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const finalScore = averageCriteriaScores(scores);

  function setCriterionScore(key: CriterionKey, value: number) {
    setScores((prev) => ({ ...prev, [key]: Math.min(10, Math.max(0, Math.round(value * 10) / 10)) }));
    setJustSaved(false);
  }

  async function confirmVote() {
    setError(null);
    setSaving(true);
    setJustSaved(false);
    try {
      const res = await fetch("/api/j/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, presentationId, scores }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Falha ao registrar a nota");
        return;
      }
      setJustSaved(true);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {VOTE_CRITERIA.map((criterion) => (
        <div key={criterion.key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">{criterion.label}</span>
            <span className="text-lg font-bold tabular-nums text-brand-blue-dark">
              {formatScore(scores[criterion.key])}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={scores[criterion.key]}
            onChange={(e) => setCriterionScore(criterion.key, parseFloat(e.target.value))}
            className="w-full accent-brand-orange"
            aria-label={criterion.label}
          />
        </div>
      ))}

      <div className="flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3">
        <span className="text-sm font-medium text-zinc-600">Nota final</span>
        <span className="text-2xl font-bold tabular-nums text-brand-blue-dark">
          {formatScore(finalScore)}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {justSaved && !error && <p className="text-sm text-brand-blue">Nota confirmada.</p>}

      <button
        onClick={confirmVote}
        disabled={saving}
        className="h-12 w-full rounded-full bg-brand-orange text-base font-semibold text-white disabled:opacity-50"
        type="button"
      >
        {saving ? "Salvando..." : "Confirmar nota"}
      </button>
    </div>
  );
}
