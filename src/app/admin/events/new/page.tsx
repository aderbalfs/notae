"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível criar o evento.");
        return;
      }

      const loginRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) {
        router.push("/admin/login");
        return;
      }
      router.push(`/admin/${body.eventId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-white px-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <h1 className="text-center text-2xl font-bold text-brand-blue-dark">
          Criar novo evento
        </h1>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Nome do evento
          <input
            className="h-12 rounded-lg border border-zinc-300 px-3 text-base focus:border-brand-blue focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Desfile 2026"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          E-mail do administrador
          <input
            className="h-12 rounded-lg border border-zinc-300 px-3 text-base focus:border-brand-blue focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            required
          />
          <span className="text-xs font-normal text-zinc-500">
            Essa credencial é única para este evento e será usada para acessar o painel.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Senha
          <input
            className="h-12 rounded-lg border border-zinc-300 px-3 text-base focus:border-brand-blue focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="text-xs font-normal text-zinc-500">Mínimo de 8 caracteres.</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-full bg-brand-blue-dark text-base font-medium text-white disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar evento"}
        </button>
      </form>
    </main>
  );
}
