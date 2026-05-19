import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Source_Sans_3, Literata } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const serif = Literata({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "CACSS Library | Central Arizona Cactus & Succulent Society",
  description:
    "Specialty lending catalog for rare botanical books, journals, and archival materials stewarded by CACSS volunteers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${serif.variable} min-h-screen font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
