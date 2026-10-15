import { Card } from "@/app/_components/ui/card";
import { formatUtc } from "@/lib/ui/format";
import { AnswerForm } from "./answer-form";
import { EvidenceChips, buildSources, type Workspace } from "./evidence-chips";
import { SectionHeader } from "./report-header";

export function QuestionsSection({
  questions,
  ws,
  reportId,
  signedIn,
}: {
  questions: Workspace["questions"];
  ws: Pick<Workspace, "chunks" | "events" | "thresholds">;
  reportId: number;
  signedIn: boolean;
}) {
  const sources = buildSources(ws);
  return (
    <Card as="section" id="questions" aria-labelledby="questions-heading" className="scroll-mt-20">
      <SectionHeader
        id="questions-heading"
        title="Follow-up questions"
        description="Questions the AI suggests asking on site."
        count={questions.length}
      />
      {questions.length === 0 ? (
        <p className="text-sm text-muted">No follow-up questions were proposed.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="rounded-md border border-line p-4 text-sm">
              <p className="font-medium whitespace-pre-wrap">{q.question}</p>
              <EvidenceChips citations={q.citations} sources={sources} />
              {q.answer !== null ? (
                <div className="mt-3">
                  <p className="whitespace-pre-wrap">{q.answer}</p>
                  <p className="mt-1 text-muted">
                    Answered by {q.answeredBy ?? "unknown"} · {formatUtc(q.answeredAt)}
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-muted">Awaiting an answer</p>
                  <AnswerForm reportId={reportId} questionId={q.id} signedIn={signedIn} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
