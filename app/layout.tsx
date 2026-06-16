import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizon — The Elegant Taper",
  description: "A graceful system for the transition to everything that matters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "#ecf3ef", color: "#1a2e25" }}>
        {children}
      </body>
    </html>
  );
}
