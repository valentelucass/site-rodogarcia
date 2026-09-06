import type { ResponsiveImageSources, ResponsiveMediaPresentation } from "./media";

export type ButtonVariant = "solid" | "outline";
export type HomeMediaType = "image" | "video";
export type HomeHeroMode = "text-media-buttons" | "text-media" | "media-only";
export type QuickActionType = "link" | "external" | "download" | "modal";

export interface QuickAction {
  id: string;
  order?: number;
  label: string;
  href: string;
  icon: string;
  type: QuickActionType;
  enabled: boolean;
  downloadFile?: string;
}

export interface HomeMedia extends ResponsiveImageSources {
  type: HomeMediaType;
  src: string;
  alt?: string;
  poster?: string;
  desktopSrc?: string;
  mobileSrc?: string;
  presentation?: ResponsiveMediaPresentation;
}

export interface HomeHeroButton {
  label: string;
  url: string;
  enabled: boolean;
  color?: string;
  variant?: ButtonVariant;
}

export interface HomeHeroSlide {
  id: string;
  order?: number;
  title: string;
  description: string;
  media: HomeMedia;
  active?: boolean;
  mode: HomeHeroMode;
  buttons: HomeHeroButton[];
  createdAt?: string;
  updatedAt?: string;
}

export interface HomeInteractiveItem {
  id: string;
  order?: number;
  title: string;
  description: string;
  media: HomeMedia;
}

export interface HomeSection1 {
  title: string;
  ctaLabel: string;
  ctaUrl: string;
  items: HomeInteractiveItem[];
}

export interface HomeOperationItem {
  id: string;
  order?: number;
  title: string;
  description: string;
  media: HomeMedia;
  active?: boolean;
}

export interface HomeSection2 {
  title: string;
  items: HomeOperationItem[];
}

export interface HomeServiceCard {
  id: string;
  order?: number;
  media: HomeMedia;
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface HomeSection3 {
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  cards: HomeServiceCard[];
}

export interface HomeFeedback {
  id: string;
  order?: number;
  name: string;
  role: string;
  context: string;
  testimonial: string;
  photo?: string;
  rating: number;
  active?: boolean;
}

export interface HomeSocialProof {
  title: string;
  feedbacks: HomeFeedback[];
}

export interface HomeRegionalUnit {
  id: string;
  order?: number;
  name: string;
  state: string;
  description: string;
  linkedUnitId?: string;
  address: string;
  phone: string;
  email: string;
  additionalEmail: string;
  buttonLabel?: string;
  contactUrl: string;
  active?: boolean;
}

export interface HomeRegionalPresence {
  units: HomeRegionalUnit[];
}

export interface HomeTrackingCta {
  buttons: HomeHeroButton[];
}

export interface HomePageContent {
  hero: {
    slides: HomeHeroSlide[];
  };
  section1: HomeSection1;
  section2: HomeSection2;
  section3: HomeSection3;
  regionalPresence: HomeRegionalPresence;
  trackingCta: HomeTrackingCta;
  socialProof: HomeSocialProof;
  quickActions?: QuickAction[];
}

export interface ServicesModuleImage extends ResponsiveImageSources {
  src: string;
  alt: string;
  /** Mantido temporariamente para ler conteúdo legado durante a migração. */
  position?: string;
  presentation?: ResponsiveMediaPresentation;
}

export interface ServicesModule {
  id: string;
  order?: number;
  image: ServicesModuleImage;
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  ctaLabel: string;
  ctaUrl: string;
}

export interface ServicesFinalCta {
  quoteUrl: string;
  trackingUrl: string;
}

export interface ServicesFaqItem {
  id: string;
  order?: number;
  question: string;
  answer: string;
}

export interface ServicesFaq {
  title: string;
  items: ServicesFaqItem[];
}

export interface ServicesPageContent {
  modules: ServicesModule[];
  finalCta: ServicesFinalCta;
  faq: ServicesFaq;
}

export interface PageButton {
  label: string;
  url: string;
  external?: boolean;
}

export interface PageMedia extends ResponsiveImageSources {
  src: string;
  alt: string;
  presentation?: ResponsiveMediaPresentation;
}

export interface PageFaqItem {
  id: string;
  order?: number;
  question: string;
  answer: string;
}

export interface FooterLinkItem extends PageButton {
  id: string;
  order?: number;
}

export type NavigationHighlightTone = "blue" | "emerald" | "amber" | "violet";

export interface HeaderNavigationItem {
  id: string;
  order?: number;
  group: "principal" | "explorar";
  label: string;
  url: string;
  icon: string;
  highlightLabel?: string;
  highlightTone?: NavigationHighlightTone;
}

export interface HeaderNavigationContent {
  items: HeaderNavigationItem[];
}

export interface FooterLinkColumn {
  id: string;
  order?: number;
  title: string;
  links: FooterLinkItem[];
}

export interface FooterSocialLink extends FooterLinkItem {
  icon: string;
}

export interface FooterGlobalContent {
  description: string;
  proposalButton: PageButton;
  supportButton: PageButton;
  columns: FooterLinkColumn[];
  serviceHoursTitle: string;
  serviceHours: string[];
  socialTitle: string;
  socialLinks: FooterSocialLink[];
  bottomLinks: FooterLinkItem[];
  copyrightText: string;
  locationText: string;
  creditText: string;
  creditUrl: string;
}

export interface FooterTextBlock {
  id: string;
  order?: number;
  title: string;
  description: string;
}

export interface FooterActionCard extends FooterTextBlock {
  icon: string;
  button: PageButton;
}

export interface FooterLinksTermsContent {
  hero: {
    eyebrow: string;
    titleHighlight: string;
    titleRest: string;
    description: string;
  };
  summary: {
    eyebrow: string;
    title: string;
    description: string;
    body: string;
    button: PageButton;
  };
  reading: {
    eyebrow: string;
    title: string;
    description: string;
    blocks: FooterTextBlock[];
  };
  finalCta: {
    title: string;
    description: string;
    buttons: PageButton[];
  };
}

export interface FooterLinksHelpContent {
  hero: {
    eyebrow: string;
    titleHighlight: string;
    titleRest: string;
    description: string;
    buttons: PageButton[];
  };
  quickAccess: {
    eyebrow: string;
    title: string;
    description: string;
    actions: FooterActionCard[];
  };
  contactCard: {
    phone: string;
    hours: string;
    channelDescriptions: string[];
  };
  faq: {
    eyebrow: string;
    title: string;
    description: string;
    items: PageFaqItem[];
  };
  finalSupport: {
    eyebrow: string;
    title: string;
    description: string;
    button: PageButton;
  };
}

export interface FooterLinksPrivacyContent {
  hero: {
    eyebrow: string;
    titleHighlight: string;
    titleRest: string;
    description: string;
    button: PageButton;
  };
  dataSection: {
    eyebrow: string;
    title: string;
    description: string;
    blocks: FooterTextBlock[];
  };
  finalCta: {
    title: string;
    description: string;
    buttons: PageButton[];
  };
}

export interface FooterLinksContent {
  footer: FooterGlobalContent;
  terms: FooterLinksTermsContent;
  help: FooterLinksHelpContent;
  privacy: FooterLinksPrivacyContent;
}

export interface AboutPageContent {
  hero: {
    title: string;
    description: string;
    buttons: PageButton[];
    media: PageMedia;
  };
  compliance: {
    image: PageMedia;
    title: string;
    description: string;
    certificateText: string;
    certificateUrl?: string;
    certifications: Array<{
      title: string;
      description: string;
      image: PageMedia;
      certificateUrl?: string;
    }>;
  };
  finalCta: {
    title: string;
    description: string;
    buttons: PageButton[];
  };
}

export interface BusinessPageContent {
  scaleCta: {
    buttons: PageButton[];
  };
  faq: {
    title: string;
    items: PageFaqItem[];
  };
}

export interface ContactPageChannel {
  id: string;
  order?: number;
  title: string;
  description: string;
  button: PageButton;
}

export interface ContactPageInfoItem {
  id: string;
  order?: number;
  label: string;
  title: string;
  description: string;
}

export interface ContactPageContent {
  heroWhatsappButton: PageButton;
  mainChannels: ContactPageChannel[];
  info: {
    items: ContactPageInfoItem[];
    companyTitle: string;
    address: string;
    hours: string;
    channelGuideTitle: string;
    channelGuideDescription: string;
    documentsDescription: string;
    quickSupportDescription: string;
    indicators: Array<{
      id: string;
      order?: number;
      value: string;
      description: string;
    }>;
  };
  finalCta: {
    buttons: PageButton[];
  };
}

export interface CareersPageJob {
  id: string;
  order?: number;
  title: string;
  location: string;
  type: string;
  description: string;
  applyUrl: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CareersPageContent {
  hero: {
    buttons: PageButton[];
  };
  cultureImage: PageMedia;
  jobs: CareersPageJob[];
  directApplication: {
    buttons: PageButton[];
  };
  finalCta: {
    buttons: PageButton[];
  };
}

export interface QuoteDirectChannel {
  id: string;
  order?: number;
  title: string;
  description: string;
  button: PageButton;
}

export interface QuoteOtherChannel {
  id: string;
  order?: number;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  button: PageButton;
  buttonColor: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuoteUnservedOriginContent {
  title: string;
  description: string;
  button: PageButton;
}

export interface QuotePageContent {
  hero: {
    buttons: PageButton[];
  };
  operationGuidance: OperationGuidanceContent;
  approvalChannel: {
    whatsappUrl: string;
  };
  unservedOrigin: QuoteUnservedOriginContent;
  directChannels: QuoteDirectChannel[];
  otherChannels: QuoteOtherChannel[];
}

export interface CollectionsPageContent {
  hero: {
    buttons: PageButton[];
  };
  operationGuidance: OperationGuidanceContent;
}

export interface ImprovementsPageContent {
  operationGuidance: OperationGuidanceContent;
}

export interface OperationGuidanceContent {
  eyebrow: string;
  title: string;
  description: string;
  items: PageFaqItem[];
}

export interface OperationalUnit {
  id: string;
  order?: number;
  name: string;
  type?: string;
  state: string;
  city?: string;
  address: string;
  phone?: string;
  email?: string;
  additionalEmail: string;
  contactUrl?: string;
  contactLabel?: string;
  description?: string;
  logisticsInfo?: string;
  quoteCnpj?: string;
  genericPostalCode?: string;
  isDefault?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
