import { Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";

/** The three typefaces of the redesigned pages (landing, birth chart), loaded once.
 * The variable names are what landing.css and chart.css read. */
export const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-ln-serif" });
export const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-ln-sans" });
export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-ln-mono" });

export const designFonts = `${serif.variable} ${sans.variable} ${mono.variable}`;
