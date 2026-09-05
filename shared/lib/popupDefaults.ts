import type { ResponsiveMediaPresentation } from "@shared/types/media";

export interface PopupConfig {
  enabled: boolean;
  title: string;
  description: string;
  enableName: boolean;
  enableEmail: boolean;
  enablePhone: boolean;
  buttonText: string;
  closeText: string;
  successMessage: string;
  badgeText?: string;
  image?: string;
  /** Enquadramento da imagem padrão quando ela for usada pelo popup. */
  imagePresentation?: ResponsiveMediaPresentation;
  delaySeconds: number;
  cooldownHours: number;
  maxShowsPerSession: number;
  mobileScrollTrigger?: boolean;
  mobileBackButtonTrigger?: boolean;
  desktop?: {
    title?: string;
    description?: string;
    image?: string;
    /** Enquadramento da imagem exclusiva para telas maiores. */
    imagePresentation?: ResponsiveMediaPresentation;
  };
  mobile?: {
    title?: string;
    description?: string;
    image?: string;
    /** Enquadramento da imagem exclusiva para o layout de celular. */
    imagePresentation?: ResponsiveMediaPresentation;
    sheetTitle?: string;
  };
}

export const DEFAULT_POPUP_CONFIG: PopupConfig = {
  enabled: true,
  title: "Antes de sair...",
  description: "Quer receber nosso conteúdo gratuito antes de ir?",
  enableName: true,
  enableEmail: true,
  enablePhone: true,
  buttonText: "Receber conteúdo",
  closeText: "Fechar",
  successMessage: "Recebemos seus dados. Em breve entraremos em contato.",
  badgeText: "Oferta especial",
  image: "",
  delaySeconds: 10,
  cooldownHours: 24,
  maxShowsPerSession: 1,
  mobileScrollTrigger: true,
  mobileBackButtonTrigger: true,
  desktop: {
    title: "Antes de sair...",
    description: "Receba uma proposta personalizada para sua operação logística.",
    image: "",
  },
  mobile: {
    title: "Antes de sair...",
    description: "Receba atendimento pelo celular em poucos segundos.",
    image: "",
    sheetTitle: "Fale com a Rodogarcia",
  },
};
