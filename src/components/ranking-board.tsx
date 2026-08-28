import type { RankingEntry } from "@/lib/server/results";

function formatScore(score: number) {
  return score.toFixed(1).replace(".", ",");
}

const PODIUM: Array<{ rank: 1 | 2 | 3; heightClass: string; medal: string }> = [
  { rank: 2, heightClass: "h-20", medal: "🥈" },
  { rank: 1, heightClass: "h-28", medal: "🥇" },
  { rank: 3, heightClass: "h-14", medal: "🥉" },
];

export function RankingBoard({ ranking }: { ranking: RankingEntry[] }) {
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-center gap-3">
        {PODIUM.map(({ rank, heightClass, medal }) => {
          const entry = top3[rank - 1];
          if (!entry) return null;
          return (
            <div key={entry.participantId} className="flex w-24 flex-col items-center gap-2">
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-2xl">{medal}</span>
                <span className="line-clamp-2 text-sm font-semibold text-brand-blue-dark">
                  {entry.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {entry.average != null ? formatScore(entry.average) : "—"}
                </span>
              </div>
              <div
                className={`flex w-full items-start justify-center rounded-t-lg bg-brand-blue-dark pt-2 text-lg font-bold text-white ${heightClass}`}
              >
                {rank}º
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rest.map((entry, index) => (
            <li
              key={entry.participantId}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm"
            >
              <span className="text-zinc-700">
                <span className="mr-2 font-semibold text-zinc-400">{index + 4}º</span>
                {entry.name}
              </span>
              <span className="font-semibold text-brand-blue-dark">
                {entry.average != null ? formatScore(entry.average) : "—"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
