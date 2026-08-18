import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Taskora",
  description:
    "A polished delivery ledger for freelancers to log proof, track payments, and keep client work organized.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-body bg-cream-50 text-ember-700 bg-grain bg-grain antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
