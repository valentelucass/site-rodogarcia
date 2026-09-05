"use client";

import { useEffect, useState, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import type { ResponsiveMediaPresentation } from "@shared/types/media";
import { mediaObjectPosition } from "@/lib/mediaPresentation";

type PresentedImageProps = Omit<ComponentPropsWithoutRef<"img">, "src"> & {
  src: string;
  mobileSrc?: string;
  presentation?: ResponsiveMediaPresentation;
  mobileBreakpoint?: number;
};

/** Imagem responsiva que conserva o enquadramento escolhido para cada dispositivo. */
export function PresentedImage({
  src,
  mobileSrc,
  presentation,
  mobileBreakpoint = 767,
  style,
  ...props
}: PresentedImageProps) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mobileBreakpoint]);

  const viewport = mobile ? "mobile" : "desktop";
  const selectedSrc = mobile && mobileSrc ? mobileSrc : src;
  const combinedStyle: CSSProperties = {
    ...style,
    objectPosition: mediaObjectPosition(presentation, viewport),
  };

  return <img {...props} src={selectedSrc} style={combinedStyle} />;
}
