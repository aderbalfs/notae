import { resolveJudgeByToken } from "@/lib/server/require-judge";
import { notFound } from "next/navigation";

export default async function JudgeEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const judge = await resolveJudgeByToken(token);

  if (!judge) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Bem-vindo(a),
      </p>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {judge.name}
      </h1>
      <p className="max-w-xs text-base text-zinc-600 dark:text-zinc-400">
        Aguardando o início da votação. A tela será atualizada automaticamente
        quando o primeiro participante entrar em apresentação.
      </p>
    </main>
  );
}
