import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TopNav from "./TopNav";

export function useBackendStatus() {
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
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base text-white">
      <div className="shrink-0">
        <TopNav />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
