import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "TAR UMT Arena Insights",
    description: "Live indoor navigation map with route heatmaps and user positions.",
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
    openGraph: {
      title: "TAR UMT Arena Insights",
      description: "Live route heatmaps and user positions for Main Campus.",
      images: [{ url: `${origin}/og-map.png`, width: 1536, height: 1024, alt: "Arena map with route heatmap and live user positions" }],
    },
    twitter: { card: "summary_large_image", title: "TAR UMT Arena Insights", description: "Live route heatmaps and user positions for Main Campus.", images: [`${origin}/og-map.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
