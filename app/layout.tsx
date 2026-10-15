import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TechnicianBar } from "./_components/technician-bar";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Equipment Maintenance Triage",
  description:
    "Report equipment problems, check sensor thresholds, and review cited AI triage drafts. A technician always decides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black"
        >
          Skip to content
        </a>
        <header className="border-b border-zinc-300 dark:border-zinc-700">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link href="/" className="font-semibold tracking-tight">
                Equipment Maintenance Triage
              </Link>
              <nav aria-label="Main" className="flex gap-4 text-sm">
                <Link href="/" className="underline-offset-4 hover:underline">
                  Reports
                </Link>
                <Link href="/equipment" className="underline-offset-4 hover:underline">
                  Equipment
                </Link>
                <Link href="/reports/new" className="underline-offset-4 hover:underline">
                  New report
                </Link>
              </nav>
            </div>
            <Suspense fallback={<span className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</span>}>
              <TechnicianBar />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-zinc-300 px-4 py-4 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          AI suggestions are drafts. A technician decides.
        </footer>
      </body>
    </html>
  );
}
