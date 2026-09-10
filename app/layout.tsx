import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Claims Navigator",
  description: "Decision support for the Insurance Claims Approval Department",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper-50 text-ink antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:pt-8">{children}</main>
      </body>
    </html>
  );
}
