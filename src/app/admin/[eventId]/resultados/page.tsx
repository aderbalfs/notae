"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { RankingBoard } from "@/components/ranking-board";
import { VoteBreakdownTable } from "@/components/vote-breakdown-table";
import type { EventResults, EventVoteBreakdown } from "@/lib/server/results";

export default function AdminResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [data, setData] = useState<EventResults | null>(null);
  const [breakdown, setBreakdown] = useState<EventVoteBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [resultsRes, votesRes] = await Promise.all([
        fetch(`/api/admin/events/${eventId}/results`),
        fetch(`/api/admin/events/${eventId}/votes`),
      ]);
      if (cancelled) return;
      if (!resultsRes.ok) {
        setError("Não foi possível carregar a apuração. Faça login novamente.");
        return;
      }
      setData(await resultsRes.json());
      if (votesRes.ok) {
        setBreakdown(await votesRes.json());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-700">{error}</p>
        <Link href="/admin/login" className="text-sm font-medium underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-brand-blue-dark">Apuração</h1>
      </header>

      {!data.votingComplete && (
        <p className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
          A votação ainda não foi encerrada para todos os participantes. O
          resultado abaixo é parcial.
        </p>
      )}

      {data.ranking.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum participante cadastrado.</p>
      ) : (
        <RankingBoard ranking={data.ranking} />
      )}

      {data.votingComplete && breakdown && breakdown.participants.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-brand-blue-dark">Votos por jurado</h2>
          <VoteBreakdownTable judges={breakdown.judges} participants={breakdown.participants} />
        </section>
      )}
    </div>
  );
}
