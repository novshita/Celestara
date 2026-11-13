import { SiteShell } from "@/components/SiteShell";

/** Everything inside this group wears the app header; the URL is unaffected. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
