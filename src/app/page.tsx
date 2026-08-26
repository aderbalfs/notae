export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Notae
      </h1>
      <p className="max-w-xs text-base text-zinc-600 dark:text-zinc-400">
        Sistema de votação em tempo real para desfile.
      </p>
      <a
        href="/admin/login"
        className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-zinc-900 px-6 text-base font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        Acessar painel do administrador
      </a>
      <p className="text-sm text-zinc-500 dark:text-zinc-500">
        Jurados acessam pelo link enviado pelo administrador do evento.
      </p>
    </main>
  );
}
