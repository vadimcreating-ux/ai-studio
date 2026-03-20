import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TopNav from "./TopNav";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../shared/api/client";

function useBackendStatus() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/health");
      if (!res.ok) throw new Error("offline");
      return res.json();
    },
    refetchInterval: 30_000,
    retry: false,
  });
}

function useKieBalance(enabled: boolean) {
  return useQuery({
    queryKey: ["kie-balance"],
    queryFn: () => api.get<{ ok: boolean; balance: unknown }>("/api/kie-balance").then((d) => d.balance),
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled,
  });
}

export default function AppLayout() {
  const { user } = useAuth();
  const { data, isError } = useBackendStatus();
  const { data: kieBalance } = useKieBalance(user?.role === "admin");
  const online = !!data?.ok && !isError;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base text-white">
      <div className="relative shrink-0">
        <TopNav />
        {/* Right side indicators */}
        <div className="absolute top-1/2 -translate-y-1/2 right-[220px] z-40 flex items-center gap-2">
          {user?.role === "admin" && kieBalance !== null && kieBalance !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[#0d1f35] text-[#58a6ff] border-[#1f4070]">
              <span className="text-[10px] text-[#8b949e]">KIE</span>
              {typeof kieBalance === "number" ? kieBalance.toLocaleString() : String(kieBalance)}
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            online
              ? "bg-[#0f2e1a] text-green-400 border-green-900"
              : "bg-red-950/50 text-red-400 border-red-900"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
            {online ? "online" : "offline"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
