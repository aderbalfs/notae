"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminEventLayout({
  params,
  children,
}: {
  params: Promise<{ eventId: string }>;
  children: React.ReactNode;
}) {
  const { eventId } = use(params);
  const [eventName, setEventName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/events/${eventId}`);
      if (cancelled) return;
      if (!res.ok) {
        setError("Não foi possível carregar o evento. Faça login novamente.");
        return;
      }
      const body = await res.json();
      if (!cancelled) setEventName(body.event.name);
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

  if (!eventName) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </main>
    );
  }

  return (
    <AdminSidebar eventId={eventId} eventName={eventName}>
      {children}
    </AdminSidebar>
  );
}
