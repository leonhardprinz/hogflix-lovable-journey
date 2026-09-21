import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";

/**
 * /finance - the HogFlix Finance reporting app.
 *
 * A self-contained static app (public/finance-app) where every figure is one call to a PostHog
 * Endpoint via /api/finance. It ships its own light theme and global styles, so it is mounted in
 * an iframe rather than inlined: nothing leaks into the HogFlix Tailwind theme and vice versa.
 *
 * Optional: /finance?for=Acme labels the "For ..." box in the info panels for a given audience.
 */
const Finance = () => {
  const [params] = useSearchParams();
  const src = useMemo(() => {
    const audience = params.get("for");
    return `/finance-app/index.html${audience ? `?for=${encodeURIComponent(audience)}` : ""}`;
  }, [params]);

  return (
    <div className="h-screen bg-background-dark flex flex-col">
      <Header />
      <iframe
        title="HogFlix Finance"
        src={src}
        className="flex-1 w-full border-0 bg-[#f6f5f1]"
        allow="fullscreen"
      />
    </div>
  );
};

export default Finance;
