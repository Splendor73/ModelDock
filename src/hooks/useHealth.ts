import { useDesktop } from "@/context/AppContext";

export function useHealth() {
  const { health, healthLoading, refreshHealth } = useDesktop();
  return { data: health, loading: healthLoading, refresh: refreshHealth };
}
