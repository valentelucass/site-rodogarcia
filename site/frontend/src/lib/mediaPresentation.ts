import type { MediaPlacement, ResponsiveMediaPresentation } from "@shared/types/media";

function coordinate(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : fallback;
}

/** Converte a configuração por uso em posição CSS, mantendo o centro como fallback seguro. */
export function mediaObjectPosition(
  presentation: ResponsiveMediaPresentation | undefined,
  viewport: "desktop" | "mobile" = "desktop"
): string {
  const point = mediaPlacement(presentation, viewport)?.focalPoint;
  return `${coordinate(point?.x, 50)}% ${coordinate(point?.y, 50)}%`;
}

/** Seleciona a configuração móvel, preservando a herança do desktop como contrato. */
export function mediaPlacement(
  presentation: ResponsiveMediaPresentation | undefined,
  viewport: "desktop" | "mobile" = "desktop"
): MediaPlacement | undefined {
  return viewport === "mobile" ? presentation?.mobile ?? presentation?.desktop : presentation?.desktop;
}
