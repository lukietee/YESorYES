import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YES or YES",
  description: "Three guppies decide your life",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-display antialiased">{children}</body>
    </html>
  );
}
