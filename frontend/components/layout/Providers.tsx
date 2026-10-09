"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session; created in state so it isn't shared across server requests
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  // Dev only: lets you poke at the cache from the browser console (window.__qc.getQueryData([...]))
  useEffect(() => {
    if (process.env.NODE_ENV === "development") (window as unknown as { __qc: QueryClient }).__qc = client;
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delay={300}>{children}</TooltipProvider>
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
