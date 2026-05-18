import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCIndiana CRM",
  description: "Donor + prospect CRM for Teen Challenge Indiana",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
