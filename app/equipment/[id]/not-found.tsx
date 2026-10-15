import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-md border border-zinc-300 p-6 dark:border-zinc-700">
      <h1 className="text-2xl font-semibold tracking-tight">Equipment not found</h1>
      <p className="mt-2 text-sm">This equipment does not exist or the link is wrong.</p>
      <p className="mt-4 text-sm">
        <Link href="/equipment" className="underline underline-offset-2 hover:no-underline">
          Back to all equipment
        </Link>
      </p>
    </div>
  );
}
