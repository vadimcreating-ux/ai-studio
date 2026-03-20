import { useQuery } from "@tanstack/react-query";

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
