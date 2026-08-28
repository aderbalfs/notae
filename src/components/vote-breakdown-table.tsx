"use client";

import { Fragment, useState } from "react";
import { VOTE_CRITERIA } from "@/lib/criteria";
import type { ParticipantVoteBreakdown } from "@/lib/server/results";

function formatScore(score: number | null) {
  return score != null ? score.toFixed(1).replace(".", ",") : "—";
}

interface VoteBreakdownTableProps {
  judges: { id: string; name: string }[];
  participants: ParticipantVoteBreakdown[];
}

export function VoteBreakdownTable({ judges, participants }: VoteBreakdownTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
              <th className="px-3 py-2 font-medium text-zinc-600">Participante</th>
              {judges.map((judge) => (
                <th key={judge.id} className="px-3 py-2 text-center font-medium text-zinc-600">
                  {judge.name}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-zinc-600">Média</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => {
              const isExpanded = expandedId === participant.participantId;
              return (
                <Fragment key={participant.participantId}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : participant.participantId)}
                    className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2 font-medium text-brand-blue-dark">{participant.name}</td>
                    {participant.judgeVotes.map((jv) => (
                      <td key={jv.judgeId} className="px-3 py-2 text-center tabular-nums text-zinc-700">
                        {formatScore(jv.score)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold tabular-nums text-brand-blue-dark">
                      {formatScore(participant.average)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-zinc-100 bg-zinc-50/60">
                      <td colSpan={judges.length + 2} className="px-3 py-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {participant.judgeVotes.map((jv) => (
                            <div key={jv.judgeId} className="rounded-lg border border-zinc-200 bg-white p-3">
                              <p className="mb-2 text-xs font-semibold text-brand-blue-dark">
                                {jv.judgeName}
                              </p>
                              {jv.scores ? (
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  {VOTE_CRITERIA.map((criterion) => (
                                    <div key={criterion.key} className="flex justify-between text-xs">
                                      <span className="text-zinc-500">{criterion.label}</span>
                                      <span className="font-medium text-zinc-700">
                                        {formatScore(jv.scores![criterion.key])}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-400">Não votou</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">
        Clique em um participante para ver os critérios de cada jurado.
      </p>
    </div>
  );
}
