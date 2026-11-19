import Link from "next/link";

import { logoutAction } from "@/app/auth-actions";
import { LogoMark } from "@/components/Logo";
import { designFonts } from "@/lib/fonts";
import { getSessionEmail } from "@/lib/session";

import { NightSky } from "./NightSky";
import "./chart.css";

/**
 * The frame of the redesigned birth-chart page (design/Celestara Birth Chart.html): a night
 * sky, a wide sticky header with the primary navigation, and the page itself. Only /chart
 * wears it for now; the other pages keep the app's standard header until they are redone.
 */
export async function ChartShell({ children }: { children: React.ReactNode }) {
  const email = await getSessionEmail();

  return (
    <div className={`cx ${designFonts}`}>
      <NightSky />
      <span className="cx-sparkle" style={{ left: "6%", top: "18%" }} aria-hidden="true"><i /></span>
      <span className="cx-sparkle" style={{ right: "5%", top: "52%", transform: "scale(.7)" }} aria-hidden="true"><i /></span>
      <span className="cx-sparkle" style={{ left: "46%", bottom: "6%", transform: "scale(.5)" }} aria-hidden="true"><i /></span>

      <header className="cx-top">
        <div>
          <Link className="cx-logo" href="/" aria-label="Celestara home">
            <LogoMark size={30} />
            Celestara
          </Link>
          <nav className="cx-links" aria-label="Primary">
            <Link href={email ? "/" : "/guide"}>Home</Link>
            <Link href="/chart" aria-current="page">Birth Chart</Link>
            <Link href="/journal">Journal</Link>
            <Link href="/profile">Profile</Link>
          </nav>
          {email ? (
            <div className="cx-account">
              <span className="cx-hint">{email}</span>
              <form action={logoutAction}>
                <button type="submit" className="cx-login">Log out</button>
              </form>
            </div>
          ) : (
            <Link className="cx-login" href="/profile">Log in</Link>
          )}
        </div>
      </header>

      {children}

      <footer className="cx-foot">
        Celestara treats astrology as an interpretive and traditional framework, not scientifically validated prediction.
      </footer>
    </div>
  );
}
