"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface EventSummary {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "rascunho",
  in_progress: "em andamento",
  finished: "encerrado",
  cancelled: "cancelado",
};

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/admin/events");
    if (!res.ok) {
      setError("Não foi possível carregar seus eventos. Faça login novamente.");
      return;
    }
    const body: { events: EventSummary[] } = await res.json();
    setEvents(body.events);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial de dados no mount
    loadEvents();
  }, [loadEvents]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível criar o evento.");
        return;
      }
      router.push(`/admin/${body.eventId}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleCancel(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/events/${id}/cancel`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Falha ao cancelar o evento.");
        return;
      }
      await loadEvents();
    } finally {
      setBusyId(null);
    }
  }

  async function handleFinish(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/events/${id}/finish`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Falha ao encerrar o evento.");
        return;
      }
      await loadEvents();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, eventName: string) {
    const confirmed = window.confirm(
      `Apagar "${eventName}" definitivamente? Participantes, jurados e votos serão perdidos junto. Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Falha ao apagar o evento.");
        return;
      }
      await loadEvents();
    } finally {
      setBusyId(null);
    }
  }

  if (error && !events) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-700">{error}</p>
        <Link href="/admin/login" className="text-sm font-medium underline">
          Ir para o login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-brand-blue-dark">Meus eventos</h1>
        <p className="text-sm text-zinc-500">
          Crie quantos eventos precisar para testar cenários antes da apresentação real.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Nome do novo evento
          <input
            className="h-11 rounded-lg border border-zinc-300 px-3 text-base focus:border-brand-blue focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Desfile de teste"
            required
          />
        </label>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="h-11 rounded-full bg-brand-blue-dark text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Criando..." : "Criar evento"}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        {events === null ? (
          <p className="text-sm text-zinc-500">Carregando...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento criado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => {
              const isBusy = busyId === event.id;
              const isCancelled = event.status === "cancelled";
              const isFinished = event.status === "finished";
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link href={`/admin/${event.id}`} className="min-w-0 flex-1 hover:underline">
                    <span className="font-medium text-brand-blue-dark">{event.name}</span>{" "}
                    <span className="text-xs text-zinc-500">
                      {STATUS_LABELS[event.status] ?? event.status}
                    </span>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleCancel(event.id)}
                      disabled={isBusy || isCancelled}
                      className="h-8 rounded-full border border-zinc-300 px-3 text-xs font-medium text-zinc-600 disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleFinish(event.id)}
                      disabled={isBusy || isFinished || isCancelled}
                      className="h-8 rounded-full border border-zinc-300 px-3 text-xs font-medium text-zinc-600 disabled:opacity-40"
                    >
                      Encerrar
                    </button>
                    <button
                      onClick={() => handleDelete(event.id, event.name)}
                      disabled={isBusy}
                      className="h-8 rounded-full border border-red-200 px-3 text-xs font-medium text-red-600 disabled:opacity-40"
                    >
                      Apagar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
