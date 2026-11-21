import Link from "next/link";

import { logoutAction } from "@/app/auth-actions";
import { LogoMark } from "@/components/Logo";
import { designFonts } from "@/lib/fonts";
import { getSessionEmail } from "@/lib/session";

import { NightSky } from "./NightSky";
import "./chart.css";
import "../account/account.css";

/**
 * The frame of the redesigned pages (design/Celestara Birth Chart.html, design/Celestara
 * Home.html): a night sky, a wide sticky header with the primary navigation, and the page
 * itself. Home, Birth Chart, Journal and Profile all wear it.
 */
export async function DesignShell({
  current,
  children,
}: {
  current: "home" | "chart" | "journal" | "profile";
  children: React.ReactNode;
}) {
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
            <Link href={email ? "/" : "/guide"} aria-current={current === "home" ? "page" : undefined}>Home</Link>
            <Link href="/chart" aria-current={current === "chart" ? "page" : undefined}>Birth Chart</Link>
            <Link href="/journal" aria-current={current === "journal" ? "page" : undefined}>Journal</Link>
            <Link href="/profile" aria-current={current === "profile" ? "page" : undefined}>Profile</Link>
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
