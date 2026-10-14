import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

async function DbStatus() {
  let count: number;
  try {
    count = await prisma.equipment.count();
  } catch (error) {
    logger.error({ err: error }, "database health check failed");
    return <p role="alert">Database unreachable</p>;
  }
  return <p>Database connected. Equipment records: {count}</p>;
}

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Equipment Maintenance Triage
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Report an equipment problem and get cited, reviewable triage guidance.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p>Checking database…</p>}>
          <DbStatus />
        </Suspense>
      </div>
    </main>
  );
}
