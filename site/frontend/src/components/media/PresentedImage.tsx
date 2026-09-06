import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import type {
  ResponsiveImageSources,
  ResponsiveMediaPresentation,
} from "@shared/types/media";
import { mediaObjectPosition } from "@/lib/mediaPresentation";

type PresentedImageProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "srcSet" | "width" | "height"
> &
  ResponsiveImageSources & {
    src: string;
    mobileSrc?: string;
    presentation?: ResponsiveMediaPresentation;
    mobileBreakpoint?: number;
  };

type PresentedMediaStyle = CSSProperties & {
  "--presented-media-position-desktop"?: string;
  "--presented-media-position-mobile"?: string;
};

interface SourceCandidate {
  url: string | undefined;
  width: number | undefined;
}

/**
 * Imagem responsiva que deixa o navegador escolher a fonte antes do primeiro
 * download e conserva o enquadramento escolhido em cada viewport.
 */
export function PresentedImage({
  src,
  mobileSrc,
  presentation,
  mobileBreakpoint = 767,
  width,
  height,
  thumbnailUrl: _thumbnailUrl,
  thumbnailWidth: _thumbnailWidth,
  thumbnailHeight: _thumbnailHeight,
  mediumUrl,
  mediumWidth,
  mediumHeight: _mediumHeight,
  largeUrl,
  largeWidth,
  largeHeight: _largeHeight,
  className,
  style,
  sizes = "100vw",
  ...props
}: PresentedImageProps) {
  const normalizedMobileSrc = internalMediaUrl(mobileSrc);
  const srcSet = buildSrcSet([
    { url: mediumUrl, width: mediumWidth },
    { url: largeUrl, width: largeWidth },
    { url: src, width },
  ]);
  const { objectPosition: _objectPosition, ...callerStyle } = style ?? {};
  const combinedStyle: PresentedMediaStyle = {
    ...callerStyle,
    "--presented-media-position-desktop": mediaObjectPosition(presentation, "desktop"),
    "--presented-media-position-mobile": mediaObjectPosition(presentation, "mobile"),
  };
  const breakpointClass = mobileBreakpoint > 767
    ? "presented-media-position--mobile-lg"
    : "presented-media-position--mobile-sm";

  return (
    <picture className="contents">
      {normalizedMobileSrc && normalizedMobileSrc !== src ? (
        <source
          media={`(max-width: ${mobileBreakpoint}px)`}
          srcSet={normalizedMobileSrc}
        />
      ) : null}
      <img
        {...props}
        src={src}
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        width={positiveInteger(width)}
        height={positiveInteger(height)}
        className={["presented-media-position", breakpointClass, className]
          .filter(Boolean)
          .join(" ")}
        style={combinedStyle}
      />
    </picture>
  );
}

function buildSrcSet(candidates: SourceCandidate[]): string {
  const byWidth = new Map<number, string>();
  for (const candidate of candidates) {
    const url = internalMediaUrl(candidate.url);
    const candidateWidth = positiveInteger(candidate.width);
    if (!url || !candidateWidth) continue;
    if (!byWidth.has(candidateWidth)) {
      byWidth.set(candidateWidth, url);
    }
  }
  return [...byWidth.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([candidateWidth, url]) => `${url} ${candidateWidth}w`)
    .join(", ");
}

function internalMediaUrl(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function positiveInteger(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}
