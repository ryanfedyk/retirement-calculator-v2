"use client";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCloudSync } from "@/lib/cloud/CloudSyncProvider";
import { useFinancialStore } from "@/store/useFinancialStore";
import SignInScreen from "@/components/auth/SignInScreen";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import DashboardShell from "@/components/DashboardShell";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div
        style={{
          width: 28, height: 28, borderRadius: "50%",
          border: `3px solid ${C.border}`, borderTopColor: C.teal,
          animation: "horizon-spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes horizon-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function HorizonPage() {
  const { user, loading, configured } = useAuth();
  const { ready } = useCloudSync();
  const onboarded = useFinancialStore((s) => s.profile.onboarded);

  // No Firebase configured → land on the sign-in screen (it explains how to set up).
  if (!configured) return <SignInScreen />;

  // Resolving auth or loading the cloud profile.
  if (loading || (user && !ready)) return <Loading />;

  // Not signed in.
  if (!user) return <SignInScreen />;

  // Signed in but hasn't completed onboarding.
  if (!onboarded) return <OnboardingFlow />;

  return <DashboardShell />;
}
