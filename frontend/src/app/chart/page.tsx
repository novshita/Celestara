import type { Metadata } from "next";

import { ChartShell } from "@/components/chart/ChartShell";
import { ChartWorkspace } from "@/components/chart/ChartWorkspace";
import { birthDefaults, getSavedBirth } from "@/lib/profile";

export const metadata: Metadata = { title: "Birth Chart · Celestara" };

export default async function ChartPage() {
  const saved = await getSavedBirth();

  return (
    <ChartShell>
      <ChartWorkspace defaults={birthDefaults(saved)} saved={saved.status} />
    </ChartShell>
  );
}
