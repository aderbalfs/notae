"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "E-mail ou senha inválidos.");
        return;
      }
      router.push(`/admin/${body.eventId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-white px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col gap-4"
      >
        <h1 className="text-center text-2xl font-bold text-brand-blue-dark">
          Painel do administrador
        </h1>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          E-mail
          <input
            className="h-12 rounded-lg border border-zinc-300 px-3 text-base focus:border-brand-blue focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Senha
          <input
            className="h-12 rounded-lg border border-zinc-300 px-3 text-base focus:border-brand-blue focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-full bg-brand-blue-dark text-base font-medium text-white disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Ainda não tem uma conta?{" "}
          <Link
            href="/admin/events/new"
            className="font-semibold text-brand-blue underline"
          >
            Crie seu evento e sua credencial de acesso
          </Link>
        </p>
      </form>
    </main>
  );
}
