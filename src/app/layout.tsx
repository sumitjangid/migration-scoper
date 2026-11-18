import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Migration Copilot",
  description: "Pre-sales storefront migration scoping",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
