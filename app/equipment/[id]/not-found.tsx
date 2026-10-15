import { LinkButton } from "../../_components/ui/button";
import { EmptyState } from "../../_components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="space-y-6">
      <h1>Equipment not found</h1>
      <EmptyState
        title="This equipment does not exist"
        description="This equipment does not exist or the link is wrong."
        action={
          <LinkButton href="/equipment" variant="secondary">
            Back to all equipment
          </LinkButton>
        }
      />
    </div>
  );
}
