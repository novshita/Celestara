import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { AccountBar } from "@/components/AccountBar";
import { SiteNav } from "@/components/SiteNav";
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
  title: "Celestara",
  description:
    "A personalized celestial exploration platform for reading your birth chart through Vedic and Western astrology.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-800">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
            <Link
              href="/"
              className="text-lg font-semibold text-amber-300"
            >
              🌌 Celestara
            </Link>
            <SiteNav />
            <AccountBar />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
