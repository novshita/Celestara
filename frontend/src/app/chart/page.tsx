import type { Metadata } from "next";

import { DesignShell } from "@/components/chart/DesignShell";
import { ChartWorkspace } from "@/components/chart/ChartWorkspace";
import { LENSES } from "@/components/chart/lenses";
import { birthDefaults, getSavedBirth } from "@/lib/profile";
import { UNIVERSE_BODIES } from "@/lib/universe";

export const metadata: Metadata = { title: "Birth Chart · Celestara" };

/** `?lens=` and `?body=` let a link (the landing page's callouts) open the chart page with a view and
 * a planet already chosen. Anything that is not a real choice is ignored. */
export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const lens = LENSES.find((l) => l.key === params["lens"])?.key;
  const body = UNIVERSE_BODIES.find((name) => name === params["body"]);
  const saved = await getSavedBirth();

  return (
    <DesignShell current="chart">
      <ChartWorkspace defaults={birthDefaults(saved)} saved={saved.status} initialLens={lens} initialBody={body} />
    </DesignShell>
  );
}
