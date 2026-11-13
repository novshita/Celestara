import type { Metadata } from "next";

import { AppHome } from "@/components/AppHome";

export const metadata: Metadata = { title: "Guide · Celestara" };

export default function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  return <AppHome searchParams={searchParams} />;
}
