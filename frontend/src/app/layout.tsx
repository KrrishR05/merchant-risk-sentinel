import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RiskSūtra — AI Merchant Risk Intelligence",
  description: "Detect merchant account takeover through behavioral genome analysis and temporal attack-chain detection.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
