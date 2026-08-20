import "./globals.css";
import React from "react";
import { SessionProvider } from "@/lib/SessionProvider";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "Utama Memo System",
  description: "Enterprise Internal Memo Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
        <footer className="bg-slate-200 text-slate-600 text-center text-xs py-3 border-t">
          &copy; {new Date().getFullYear()} PT Utama Corp. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
