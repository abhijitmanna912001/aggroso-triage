import { Alert } from "@/app/_components/ui/alert";

export function SignedInBanner() {
  return (
    <div className="mb-6">
      <Alert tone="info">Choose your name in the header to run an analysis or record decisions.</Alert>
    </div>
  );
}
