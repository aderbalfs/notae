import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-white px-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-brand-blue-dark">Notae</h1>
      <p className="max-w-xs text-base text-zinc-600">
        Sistema de votação em tempo real para desfile.
      </p>
      <Link
        href="/admin/login"
        className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-brand-blue-dark px-6 text-base font-medium text-white"
      >
        Acessar painel do administrador
      </Link>
      <p className="text-sm text-zinc-500">
        Jurados acessam pelo link enviado pelo administrador do evento.
      </p>
    </main>
  );
}
