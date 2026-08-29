import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// The whole voice of the site: display, headings, ledes and prose.
// 300 carries the big sizes; 400 carries reading copy. Those are the only
// two the type scale asks for — every rule sets its weight through the
// `font:` shorthand — so 200 and 500 were two font files fetched to render
// nothing.
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400"],
});

// Labels only, always 10px uppercase. Never a display face.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Sashakt",
  description:
    "Founder-developer. Techfrien: systems, deployment and agentic AI for 200+ healthcare workers and legal firms. Founding team at Vinkura.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
