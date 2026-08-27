import { getJudgeState } from "@/lib/server/judge-state";
import { notFound } from "next/navigation";
import { JudgeVotingScreen } from "./voting-screen";

export default async function JudgeEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const initialState = await getJudgeState(token);

  if (!initialState) {
    notFound();
  }

  return <JudgeVotingScreen token={token} initialState={initialState} />;
}
