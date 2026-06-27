import { useEffect } from "react";

export function useJsonLd(schema: Record<string, unknown>) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    script.dataset.jsonLd = "route";
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);
}
