import { LinkButton } from "@/app/_components/ui/button";
import { EmptyState } from "@/app/_components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="Report not found"
      description="This report does not exist or the link is wrong."
      action={<LinkButton href="/">Back to all reports</LinkButton>}
    />
  );
}
