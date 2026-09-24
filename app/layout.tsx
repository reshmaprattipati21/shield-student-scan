import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ScamShield - AI Scam & Fake Offer Letter Detector",
  description: "AI-powered detection tool for identifying fraudulent job offers, phishing emails, scam text messages, and suspicious URLs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} cyber-grid relative min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
