"use client";

import { useState } from "react";
import { answerQuestionAction } from "@/app/actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { NOTE_LIMITS } from "@/lib/reports/notes";
import { FormFooter, SignInNotice, TextField, fieldErrorsOf, useActionForm } from "./form-parts";

export function AnswerForm({
  reportId,
  questionId,
  signedIn,
}: {
  reportId: number;
  questionId: number;
  signedIn: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const { state, formAction } = useActionForm(answerQuestionAction, () => setAnswer(""));

  return (
    <form action={formAction} className="mt-3 max-w-prose">
      <fieldset disabled={!signedIn} className="space-y-3">
        <legend className="sr-only">Answer this question</legend>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="questionId" value={questionId} />
        <TextField
          id={`answer-${questionId}`}
          name="answer"
          label="Your answer"
          value={answer}
          onChange={setAnswer}
          max={NOTE_LIMITS.textMax}
          errors={fieldErrorsOf(state, "answer")}
        />
        {signedIn ? null : <SignInNotice id={`answer-signin-${questionId}`} />}
        <SubmitButton label="Save answer" pendingLabel="Saving..." />
      </fieldset>
      <div className="mt-3">
        <FormFooter state={state} />
      </div>
    </form>
  );
}
