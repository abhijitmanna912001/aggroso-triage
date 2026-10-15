import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MainNav, NavLinks } from "./_components/main-nav";
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <Link href="/" className="font-semibold tracking-tight">
                Equipment Maintenance Triage
              </Link>
              {/* usePathname suspends on routes with dynamic params, so it needs its own boundary. */}
              <Suspense fallback={<NavLinks active={null} />}>
                <MainNav />
              </Suspense>
            </div>
            <Suspense fallback={<span className="text-sm text-muted">Loading…</span>}>
              <TechnicianBar />
            </Suspense>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 outline-hidden sm:px-6">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-sm text-muted">
          AI suggestions are drafts. A technician decides.
        </footer>
      </body>
    </html>
  );
}
