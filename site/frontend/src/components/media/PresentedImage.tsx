import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { preload } from "react-dom";
import type {
  ResponsiveImageSources,
  ResponsiveMediaPresentation,
} from "@shared/types/media";
import { mediaObjectPosition } from "@/lib/mediaPresentation";
import {
  canonicalPublicMediaUrl,
  nextOptimizedImageUrl,
  resolvePublicImage,
} from "@/lib/publicMedia";

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
  height: number | undefined;
}

const OPTIMIZER_WIDTHS = [256, 384, 640, 750, 828, 1080, 1200, 1920] as const;
const VERIFIED_DERIVATIVE_BRIDGE_WIDTHS = [640] as const;
const VERIFIED_DERIVATIVE_BRIDGE_QUALITY = 65;

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
  thumbnailUrl,
  thumbnailWidth,
  thumbnailHeight,
  mediumUrl,
  mediumWidth,
  mediumHeight,
  largeUrl,
  largeWidth,
  largeHeight,
  className,
  style,
  sizes = "100vw",
  fetchPriority = "auto",
  loading,
  ...props
}: PresentedImageProps) {
  const desktopImage = resolvePublicImage(src);
  const mobileImage = resolvePublicImage(mobileSrc);
  const configuredWidth = positiveInteger(width);
  const configuredHeight = positiveInteger(height);
  const intrinsicWidth = desktopImage.width
    ?? (configuredWidth && configuredHeight ? configuredWidth : undefined);
  const intrinsicHeight = desktopImage.height
    ?? (configuredWidth && configuredHeight ? configuredHeight : undefined);
  const derivativeCandidates = [
    { url: thumbnailUrl, width: thumbnailWidth, height: thumbnailHeight },
    { url: mediumUrl, width: mediumWidth, height: mediumHeight },
    { url: largeUrl, width: largeWidth, height: largeHeight },
  ];
  const verifiedDerivativeWidths = derivativeCandidates
    .map(verifiedCandidateWidth)
    .filter((candidateWidth): candidateWidth is number => candidateWidth !== undefined);
  const hasVerifiedDerivative = verifiedDerivativeWidths.length > 0;
  const optimizerSourceWidth = maximumWidth([
    intrinsicWidth,
    ...verifiedDerivativeWidths,
  ]);
  const srcSet = hasVerifiedDerivative
    ? buildSrcSet(
        [
          ...derivativeCandidates,
          { url: desktopImage.url, width: intrinsicWidth, height: intrinsicHeight },
        ],
        desktopImage.url,
        optimizerSourceWidth
      )
    : buildOptimizedSrcSet(desktopImage.url, intrinsicWidth);
  const mobileSrcSet = mobileImage.url && mobileImage.url !== desktopImage.url
    ? buildOptimizedSrcSet(mobileImage.url, mobileImage.width)
    : "";
  const fallbackSrc = hasVerifiedDerivative
    ? desktopImage.url
    : optimizedFallback(desktopImage.url, intrinsicWidth);
  const mobileFallback = optimizedFallback(mobileImage.url, mobileImage.width);
  const { objectPosition: _objectPosition, ...callerStyle } = style ?? {};
  const combinedStyle: PresentedMediaStyle = {
    ...callerStyle,
    "--presented-media-position-desktop": mediaObjectPosition(presentation, "desktop"),
    "--presented-media-position-mobile": mediaObjectPosition(presentation, "mobile"),
  };
  const breakpointClass = mobileBreakpoint > 767
    ? "presented-media-position--mobile-lg"
    : "presented-media-position--mobile-sm";

  if (fetchPriority === "high" && loading !== "lazy" && fallbackSrc) {
    if (mobileSrcSet && mobileFallback) {
      preload(mobileFallback, {
        as: "image",
        fetchPriority: "high",
        imageSrcSet: mobileSrcSet,
        imageSizes: sizes,
        media: `(max-width: ${mobileBreakpoint}px)`,
      });
      preload(fallbackSrc, {
        as: "image",
        fetchPriority: "high",
        imageSrcSet: srcSet || undefined,
        imageSizes: srcSet ? sizes : undefined,
        media: `(min-width: ${mobileBreakpoint + 1}px)`,
      });
    } else {
      preload(fallbackSrc, {
        as: "image",
        fetchPriority: "high",
        imageSrcSet: srcSet || undefined,
        imageSizes: srcSet ? sizes : undefined,
      });
    }
  }

  return (
    <picture className="contents">
      {mobileSrcSet && mobileImage.url !== desktopImage.url ? (
        <source
          media={`(max-width: ${mobileBreakpoint}px)`}
          srcSet={mobileSrcSet}
          sizes={sizes}
        />
      ) : null}
      <img
        {...props}
        src={fallbackSrc}
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        width={intrinsicWidth}
        height={intrinsicHeight}
        fetchPriority={fetchPriority}
        loading={loading}
        className={["presented-media-position", breakpointClass, className]
          .filter(Boolean)
          .join(" ")}
        style={combinedStyle}
      />
    </picture>
  );
}

function buildSrcSet(
  candidates: SourceCandidate[],
  optimizerSourceUrl?: string,
  optimizerSourceWidth?: number
): string {
  const byWidth = new Map<number, string>();
  for (const candidate of candidates) {
    const image = resolvePublicImage(candidate.url);
    const url = image.url;
    const candidateWidth = positiveInteger(candidate.width);
    const candidateHeight = positiveInteger(candidate.height);
    const resolvedWidth = image.width
      ?? (candidateWidth && candidateHeight ? candidateWidth : undefined);
    if (!url || !resolvedWidth) continue;
    if (!byWidth.has(resolvedWidth)) {
      byWidth.set(resolvedWidth, url);
    }
  }

  const sourceUrl = canonicalPublicMediaUrl(optimizerSourceUrl);
  const sourceWidth = positiveInteger(optimizerSourceWidth);
  if (sourceUrl && sourceWidth) {
    for (const candidateWidth of VERIFIED_DERIVATIVE_BRIDGE_WIDTHS) {
      if (candidateWidth <= sourceWidth && !byWidth.has(candidateWidth)) {
        byWidth.set(
          candidateWidth,
          nextOptimizedImageUrl(
            sourceUrl,
            candidateWidth,
            VERIFIED_DERIVATIVE_BRIDGE_QUALITY
          )
        );
      }
    }
  }

  return [...byWidth.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([candidateWidth, url]) => `${url} ${candidateWidth}w`)
    .join(", ");
}

function verifiedCandidateWidth(candidate: SourceCandidate): number | undefined {
  const url = canonicalPublicMediaUrl(candidate.url);
  const width = positiveInteger(candidate.width);
  const height = positiveInteger(candidate.height);
  return url && width && height ? width : undefined;
}

function maximumWidth(widths: Array<number | undefined>): number | undefined {
  const validWidths = widths.filter((candidateWidth): candidateWidth is number =>
    positiveInteger(candidateWidth) !== undefined
  );
  return validWidths.length > 0 ? Math.max(...validWidths) : undefined;
}

function buildOptimizedSrcSet(url: string, sourceWidth: number | undefined): string {
  if (!url) return "";
  const maximum = sourceWidth ?? OPTIMIZER_WIDTHS.at(-1)!;
  const candidates = OPTIMIZER_WIDTHS
    .filter((candidateWidth) => candidateWidth <= maximum)
    .map((candidateWidth) => `${nextOptimizedImageUrl(url, candidateWidth)} ${candidateWidth}w`);

  if (sourceWidth && !OPTIMIZER_WIDTHS.includes(sourceWidth as (typeof OPTIMIZER_WIDTHS)[number])) {
    candidates.push(`${url} ${sourceWidth}w`);
  }
  if (candidates.length === 0) candidates.push(`${url} ${maximum}w`);
  return candidates.join(", ");
}

function optimizedFallback(url: string, sourceWidth: number | undefined): string {
  if (!url) return "";
  const requestedWidth = [...OPTIMIZER_WIDTHS]
    .reverse()
    .find((candidateWidth) => candidateWidth <= Math.min(sourceWidth ?? 1080, 1080));
  return nextOptimizedImageUrl(url, requestedWidth ?? 256);
}

function positiveInteger(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}
