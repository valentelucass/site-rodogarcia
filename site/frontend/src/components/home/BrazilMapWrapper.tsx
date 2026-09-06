"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { HomeRegionalUnit } from "@/types/content";

const BrazilMap = dynamic<{ units: HomeRegionalUnit[] }>(() => import("./BrazilMap"), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

export default function BrazilMapWrapper({ units }: { units: HomeRegionalUnit[] }) {
  const boundaryRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const boundary = boundaryRef.current;
    if (!boundary || shouldRender) return;

    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(boundary);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div
      ref={boundaryRef}
      className="min-h-[1340px] lg:min-h-[900px]"
    >
      {shouldRender ? <BrazilMap units={units} /> : <MapPlaceholder />}
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div
      className="flex min-h-[1340px] w-full items-center justify-center lg:min-h-[900px]"
      aria-label="Mapa de unidades será carregado ao se aproximar desta seção"
      role="status"
    >
      <span className="h-8 w-8 animate-pulse rounded-full border border-white/20 bg-white/10 motion-reduce:animate-none" />
    </div>
  );
}
