"use client";

import { LandingVisualEditor, type LandingMedia } from "../LandingVisualEditor";
import type { CampaignV1Sections } from "./CampaignV1SectionsEditor";

type CampaignV1Hero = {
  theme: { primaryColor: string; secondaryColor: string; backgroundColor: string; textColor: string };
  hero: {
    phone: string; email: string; logo: string; backgroundImage: string; eyebrow: string; title: string;
    description: string; ctaLabel: string; ctaUrl: string; highlights: Array<{ title: string; description: string }>; backgroundPresentation?: import("@shared/types/media").ResponsiveMediaPresentation;
  };
};

export type CampaignV1Landing = CampaignV1Hero & CampaignV1Sections & { template: "campaign-v1" };

/** Editor dedicado ao template padrão. Outros templates terão componentes irmãos neste diretório. */
export function CampaignV1Editor<T extends CampaignV1Landing>({
  landing,
  media,
  uploadingMedia,
  onChange,
  onUploadMedia,
  onDeleteMedia,
}: {
  landing: T;
  media: LandingMedia[];
  uploadingMedia: boolean;
  onChange: (update: (current: T) => T) => void;
  onUploadMedia: (file: File, alt?: string) => Promise<void>;
  onDeleteMedia: (item: LandingMedia) => Promise<void>;
}) {
  return <>
    <LandingVisualEditor landing={landing} media={media} uploadingMedia={uploadingMedia} onChange={onChange} onUploadMedia={onUploadMedia} onDeleteMedia={onDeleteMedia} />
  </>;
}
