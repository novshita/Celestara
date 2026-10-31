import type { Metadata } from "next";

import { BirthDataForm } from "@/components/BirthDataForm";
import { PageHeading } from "@/components/PageHeading";

export const metadata: Metadata = { title: "Birth Chart · Celestara" };

export default function ChartPage() {
  return (
    <>
      <PageHeading title="Birth chart">
        Enter a birth record to calculate its Vedic, Western or compared
        chart, its Vimshottari Dasha timeline, or the current transits. The
        calculation engine does the maths; nothing on this page interprets.
      </PageHeading>

      <BirthDataForm />
    </>
  );
}
