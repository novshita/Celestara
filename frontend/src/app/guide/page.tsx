import type { Metadata } from "next";

import { AppHome } from "@/components/AppHome";

export const metadata: Metadata = { title: "Guide · Celestara" };

export default function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <AppHome searchParams={searchParams} />;
}
