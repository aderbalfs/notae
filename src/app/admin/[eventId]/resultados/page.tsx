"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { RankingBoard } from "@/components/ranking-board";
import type { EventResults } from "@/lib/server/results";

export default function AdminResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [data, setData] = useState<EventResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/events/${eventId}/results`);
      if (cancelled) return;
      if (!res.ok) {
        setError("Não foi possível carregar a apuração. Faça login novamente.");
        return;
      }
      setData(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-blue-dark">Apuração</h1>
        <Link href={`/admin/${eventId}`} className="text-sm font-medium text-brand-blue underline">
          Voltar
        </Link>
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
    </main>
  );
}
