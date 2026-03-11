import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "./Sidebar";

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

export default function AppLayout() {
  const { data, isError } = useBackendStatus();
  const online = !!data?.ok && !isError;

  return (
    <div className="flex h-screen overflow-hidden bg-base text-white">
      <Sidebar />

      <div className="flex-1 overflow-hidden relative">
        {/* Backend status — fixed top right */}
        <div className="absolute top-3 right-4 z-50">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
              online
                ? "bg-[#0f2e1a] text-green-400 border-green-900"
                : "bg-red-950/50 text-red-400 border-red-900"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
            {online ? "Backend online" : "Offline"}
          </span>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
