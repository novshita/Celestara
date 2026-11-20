import type { Metadata } from "next";

import { DesignShell } from "@/components/chart/DesignShell";
import { ChartWorkspace } from "@/components/chart/ChartWorkspace";
import { birthDefaults, getSavedBirth } from "@/lib/profile";

export const metadata: Metadata = { title: "Birth Chart · Celestara" };

export default async function ChartPage() {
  const saved = await getSavedBirth();

  return (
    <DesignShell current="chart">
      <ChartWorkspace defaults={birthDefaults(saved)} saved={saved.status} />
    </DesignShell>
  );
}
