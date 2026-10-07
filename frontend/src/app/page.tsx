import { BirthDataForm } from "@/components/BirthDataForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-amber-300">🌌 Celestara</h1>
        <p className="text-slate-400">
          Enter a birth record to calculate its Vedic, Western, compared
          chart, or Vimshottari Dasha timeline. The system calculates;
          nothing here interprets.
        </p>
      </header>

      <BirthDataForm />
    </main>
  );
}
