"use client";
/**
 * CloudSyncProvider — keeps the Zustand store in sync with Firestore.
 *
 * On login: loads users/{uid}; if a saved plan exists it hydrates the store
 * (cloud wins). On any subsequent change to the persisted slice it debounce-saves
 * back to Firestore. On logout it resets the store to defaults so the next user
 * starts clean. localStorage persistence (in the store) remains the offline cache.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  useFinancialStore,
  type HorizonState,
} from "@/store/useFinancialStore";
import {
  DEFAULT_PROFILE,
  DEFAULT_SNAPSHOT,
  DEFAULT_SIM_CONFIG,
} from "@/config/sharedConfig";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface CloudSyncValue {
  /** Initial cloud load finished (or no user / not configured). */
  ready: boolean;
  status: SaveStatus;
}

const CloudSyncContext = createContext<CloudSyncValue>({ ready: true, status: "idle" });

const SAVE_DEBOUNCE_MS = 1500;
// One-time flag: reset the pre-live-price-fix plan-history trail (see load()).
const HISTORY_RESET_FLAG = "taper_planhistory_reset_v1";

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { user, configured } = useAuth();
  const [ready, setReady] = useState(!configured); // no Firebase → nothing to load
  const [status, setStatus] = useState<SaveStatus>("idle");

  const uidRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress the store-change that our own hydrate() triggers right after load.
  const skipNextSave = useRef(false);
  // Serialized last-persisted slice — lets us ignore transient changes (e.g.
  // livePrice) that don't affect the cloud document.
  const lastSerialized = useRef<string | null>(null);

  // ── Load on login / reset on logout ────────────────────────────────────────
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    async function load() {
      if (!user) {
        // Signed out: clear any previous user's data.
        if (uidRef.current) {
          skipNextSave.current = true;
          useFinancialStore.setState({
            profile: DEFAULT_PROFILE,
            snapshot: DEFAULT_SNAPSHOT,
            config: DEFAULT_SIM_CONFIG,
          });
        }
        uidRef.current = null;
        setReady(true);
        setStatus("idle");
        return;
      }

      uidRef.current = user.uid;
      setReady(false);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as Partial<HorizonState>;
          skipNextSave.current = true;
          // One-time cleanup: the plan-history trail recorded before the
          // live-price fix could snapshot holdings at $0 (quotes hadn't loaded).
          // Those points aren't reconstructable (only outputs were stored), so
          // drop the trail once here — it rebuilds correctly from the next
          // monthly snapshot. Guarded by a local flag so it runs a single time.
          let incoming = data;
          try {
            if (typeof localStorage !== "undefined" && !localStorage.getItem(HISTORY_RESET_FLAG)) {
              incoming = { ...data, planHistory: [] };
              localStorage.setItem(HISTORY_RESET_FLAG, "1");
            }
          } catch { /* localStorage unavailable — skip the reset guard */ }
          useFinancialStore.getState().hydrate(incoming);
        } else {
          // Brand-new account: start from a clean slate rather than inheriting
          // whatever localStorage holds from a previous user on this browser.
          skipNextSave.current = true;
          useFinancialStore.setState({
            profile: DEFAULT_PROFILE,
            snapshot: DEFAULT_SNAPSHOT,
            config: DEFAULT_SIM_CONFIG,
          });
        }
      } catch (e) {
        // Offline or rules issue — fall back to whatever localStorage holds.
        console.error("[cloud] load failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, configured]);

  // ── Save on change (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!configured) return;

    const unsub = useFinancialStore.subscribe((state) => {
      if (!uidRef.current) return; // not signed in

      const slice = { profile: state.profile, config: state.config, snapshot: state.snapshot, baseline: state.baseline, scenarios: state.scenarios, activeScenarioId: state.activeScenarioId, primaryScenarioId: state.primaryScenarioId, planHistory: state.planHistory };
      const serialized = JSON.stringify(slice);
      // Ignore changes that don't touch the persisted slice (e.g. livePrice).
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;

      if (skipNextSave.current) {
        skipNextSave.current = false;
        return;
      }

      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus("saving");
      saveTimer.current = setTimeout(async () => {
        const uid = uidRef.current;
        if (!uid) return;
        try {
          await setDoc(doc(db, "users", uid), {
            profile: state.profile,
            config: state.config,
            snapshot: state.snapshot,
            baseline: state.baseline,
            scenarios: state.scenarios,
            activeScenarioId: state.activeScenarioId,
            primaryScenarioId: state.primaryScenarioId,
            planHistory: state.planHistory,
            updatedAt: serverTimestamp(),
          });
          setStatus("saved");
        } catch (e) {
          console.error("[cloud] save failed", e);
          setStatus("error");
        }
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [configured]);

  return (
    <CloudSyncContext.Provider value={{ ready, status }}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync(): CloudSyncValue {
  return useContext(CloudSyncContext);
}
