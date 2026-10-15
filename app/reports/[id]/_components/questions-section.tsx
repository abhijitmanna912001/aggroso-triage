import { formatUtc } from "@/lib/ui/format";
import { EvidenceChips, buildSources, type Workspace } from "./evidence-chips";

export function QuestionsSection({
  questions,
  ws,
}: {
  questions: Workspace["questions"];
  ws: Pick<Workspace, "chunks" | "events" | "thresholds">;
}) {
  const sources = buildSources(ws);
  return (
    <section id="questions" aria-labelledby="questions-heading" className="mt-10 scroll-mt-4">
      <h2 id="questions-heading" className="text-xl font-semibold">Follow-up questions</h2>
      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No follow-up questions were proposed.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="rounded-md border border-zinc-300 p-4 text-sm dark:border-zinc-700">
              <p className="font-medium whitespace-pre-wrap">{q.question}</p>
              <EvidenceChips citations={q.citations} sources={sources} />
              {q.answer !== null ? (
                <div className="mt-3">
                  <p className="whitespace-pre-wrap">{q.answer}</p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    Answered by {q.answeredBy ?? "unknown"} · {formatUtc(q.answeredAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-zinc-600 dark:text-zinc-400">Awaiting an answer</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
