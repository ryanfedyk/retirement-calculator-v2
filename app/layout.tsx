import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { CloudSyncProvider } from "@/lib/cloud/CloudSyncProvider";
import { DialogProvider } from "@/components/ui/DialogProvider";
import SelectOnFocus from "@/components/ui/SelectOnFocus";

export const metadata: Metadata = {
  title: "Taper",
  description: "A graceful system for the transition to everything that matters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "#ecf3ef", color: "#1a2e25" }}>
        <AuthProvider>
          <CloudSyncProvider>
            <DialogProvider>
              <SelectOnFocus />
              {children}
            </DialogProvider>
          </CloudSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
