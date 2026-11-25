import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Providers } from "@/src/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PGListings Admin", template: "%s | PGListings Admin" },
  description: "PGListings administration workspace",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers())
    .get("content-security-policy")
    ?.match(/'nonce-([^']+)'/)
    ?.at(1);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="/theme.js" nonce={nonce} strategy="beforeInteractive" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
