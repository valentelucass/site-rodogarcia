import { LandingAnalytics } from "@/components/LandingAnalytics";
import type { CSSProperties } from "react";
import { LandingCookieSettingsButton } from "@/components/LandingCookieSettingsButton";
import { LandingMediaBackground, LandingPresentedMedia } from "@/components/LandingPresentedMedia";
import type { PublicLandingPage } from "@/lib/landing";
import { B2BLeadCaptureForm } from "./campaign-v1/B2BLeadCaptureForm";
import { BrazilCoverageMap } from "./campaign-v1/BrazilCoverageMap";
import { CampaignV1Faq } from "./campaign-v1/CampaignV1Faq";

const fontFamilies = {
  system: "system-ui, sans-serif",
  "space-grotesk": "Arial, sans-serif",
  "plus-jakarta": "Verdana, sans-serif",
} as const;

function Cta({ label, href, color, textColor }: { label: string; href: string; color: string; textColor: string }) {
  if (!label || !href) return null;
  return <a href={href} style={{ display: "inline-block", marginTop: 28, padding: "14px 22px", borderRadius: 999, background: color, color: textColor, fontWeight: 700, textDecoration: "none" }}>{label}</a>;
}

function Eyebrow({ children, color }: { children: string; color: string }) {
  return children ? <p style={{ color, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", fontSize: 12, margin: 0 }}>{children}</p> : null;
}

function ServiceGlyph({ index }: { index: number }) {
  const paths = [
    <g><path d="M4 8.5 12 4l8 4.5v8L12 21l-8-4.5v-8Z" /><path d="m4 8.5 8 4.5 8-4.5M12 13v8" /></g>,
    <g><path d="M3 16h12v-5H8l-2 3H3v2Zm12 0h3l2-3v-4h-5v7Z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></g>,
    <g><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.8" /></g>,
    <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  ];
  return <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 52, height: 52, margin: "0 auto 22px", borderRadius: "50%", background: "rgba(255,255,255,.12)", color: "#ffffff" }}><svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[index % paths.length]}</svg></span>;
}

function FeedbackAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL";
  return <span aria-hidden="true" style={{ display: "grid", placeItems: "center", flex: "0 0 auto", width: 42, height: 42, borderRadius: "50%", background: "rgba(17,17,17,.1)", fontSize: 13, fontWeight: 800 }}>{initials}</span>;
}

function FeedbackStars({ rating }: { rating: number }) {
  return <span aria-label={`${rating} de 5 estrelas`} style={{ display: "block", marginTop: 18, color: "#d69e00", fontSize: 18, letterSpacing: 2 }}>{Array.from({ length: 5 }, (_, index) => index < rating ? "★" : "☆").join("")}</span>;
}

function CampaignMedia({ landing, url, fallbackAlt, style, presentation }: {
  landing: PublicLandingPage;
  url: string;
  fallbackAlt: string;
  style: CSSProperties;
  presentation: PublicLandingPage["story"]["imagePresentation"];
}) {
  const descriptor = landing.media[url];
  return <LandingPresentedMedia url={url} descriptor={descriptor} presentation={presentation} fallbackAlt={fallbackAlt} style={style} />;
}

/** Renderizador público exclusivo do template campaign-v1. */
export function CampaignV1View({ landing, preview = false }: { landing: PublicLandingPage; preview?: boolean }) {
  const { theme } = landing;
  const hasBackgroundImage = Boolean(landing.hero.backgroundImage);
  const heroTextColor = hasBackgroundImage ? "#ffffff" : theme.textColor;
  const mutedHeroText = hasBackgroundImage ? "rgba(255,255,255,.84)" : theme.textColor;
  const contentPadding = "max(24px, 8vw)";
  const sectionDivider = "1px solid rgba(17,17,17,.14)";

  return <main style={{ background: theme.backgroundColor, color: theme.textColor, fontFamily: fontFamilies[theme.font] }}>
    {preview ? null : <LandingAnalytics measurementId={landing.analytics.ga4MeasurementId} />}
    <LandingMediaBackground as="section" url={landing.hero.backgroundImage} presentation={landing.hero.backgroundPresentation} overlay="linear-gradient(90deg, rgba(4,11,25,.86), rgba(4,11,25,.2))" style={{ minHeight: "68vh", color: heroTextColor, background: hasBackgroundImage ? theme.primaryColor : theme.backgroundColor, padding: `0 ${contentPadding} 72px` }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 16px", minHeight: 44, alignItems: "center", padding: "13px 0", fontSize: 14, borderBottom: `1px solid ${hasBackgroundImage ? "rgba(255,255,255,.18)" : "rgba(17,17,17,.16)"}` }}>
        <span>{landing.hero.phone}</span><span>{landing.hero.email}</span>
      </div>
      <div style={{ minHeight: "56vh", display: "grid", alignContent: "center" }}>
        {landing.hero.logo ? <CampaignMedia landing={landing} url={landing.hero.logo} fallbackAlt={landing.name} presentation={{ desktop: { focalPoint: { x: 50, y: 50 } } }} style={{ width: 210, maxWidth: "60%", marginBottom: 48 }} /> : <strong style={{ fontSize: 26, letterSpacing: ".06em", marginBottom: 48 }}>SUA LOGO</strong>}
        <div style={{ maxWidth: 760 }}>
          <Eyebrow color={mutedHeroText}>{landing.hero.eyebrow}</Eyebrow>
          <h1 style={{ fontSize: "clamp(2.6rem, 7vw, 5.5rem)", lineHeight: .95, letterSpacing: "-.055em", margin: "18px 0" }}>{landing.hero.title}</h1>
          <p style={{ maxWidth: 620, fontSize: "clamp(1rem, 2vw, 1.25rem)", lineHeight: 1.65, color: mutedHeroText }}>{landing.hero.description}</p>
          <Cta label={landing.hero.ctaLabel} href={landing.hero.ctaUrl} color={theme.primaryColor} textColor={theme.backgroundColor} />
        </div>
        {landing.hero.highlights.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 34, maxWidth: 1000 }}>
          {landing.hero.highlights.map((item, index) => <article key={`${item.title}-${index}`} style={{ padding: 18, border: `1px solid ${hasBackgroundImage ? "rgba(255,255,255,.56)" : "rgba(17,17,17,.2)"}`, borderRadius: 12, background: hasBackgroundImage ? "rgba(8,16,28,.5)" : theme.backgroundColor, backdropFilter: hasBackgroundImage ? "blur(8px)" : undefined }}><strong>{item.title}</strong><p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.45, color: mutedHeroText }}>{item.description}</p></article>)}
        </div> : null}
      </div>
    </LandingMediaBackground>

    {landing.lowerSection.visible ? <section style={{ borderTop: sectionDivider, padding: `clamp(56px, 7vw, 88px) ${contentPadding}`, background: theme.backgroundColor }}>
      <div style={{ maxWidth: 820, margin: "0 auto clamp(34px, 5vw, 56px)", textAlign: "center" }}>
        <Eyebrow color={theme.primaryColor}>Cobertura nacional</Eyebrow>
        <h2 style={{ margin: "14px auto", fontSize: "clamp(2rem, 4vw, 3.75rem)", lineHeight: .98, letterSpacing: "-.05em", textTransform: "uppercase" }}>{landing.lowerSection.title}</h2>
        <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.7, color: "rgba(17,17,17,.76)" }}>{landing.lowerSection.description}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "clamp(32px, 6vw, 88px)", alignItems: "center", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ minWidth: 0 }}>
          <BrazilCoverageMap colors={{ baseColor: landing.lowerSection.mapBaseColor, branchColor: landing.lowerSection.mapBranchColor, borderColor: landing.lowerSection.mapBorderColor }} />
        </div>
        <B2BLeadCaptureForm title={landing.lowerSection.formTitle} description={landing.lowerSection.formDescription} submitLabel={landing.lowerSection.submitLabel} panelColor={theme.secondaryColor} buttonColor={theme.backgroundColor} buttonTextColor={theme.textColor} preview={preview} />
      </div>
    </section> : null}

    {landing.benefits.visible ? <section style={{ borderTop: sectionDivider, padding: `clamp(72px, 9vw, 112px) ${contentPadding} 42px`, background: theme.backgroundColor }}><div style={{ maxWidth: 1480, margin: "0 auto", textAlign: "center" }}><Eyebrow color={theme.primaryColor}>{landing.benefits.eyebrow}</Eyebrow><h2 style={{ maxWidth: 980, margin: "14px auto 0", fontSize: "clamp(2rem, 4vw, 3.75rem)", lineHeight: .98, letterSpacing: "-.045em", textTransform: "uppercase" }}>{landing.benefits.title}</h2>{landing.benefits.description ? <p style={{ maxWidth: 720, margin: "18px auto 0", fontSize: "1.05rem", lineHeight: 1.65 }}>{landing.benefits.description}</p> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginTop: 34 }}>{landing.benefits.items.map((item, index) => <article key={`${item.title}-${index}`} style={{ display: "grid", alignContent: "center", minHeight: 290, borderRadius: 22, padding: "34px 26px", background: theme.secondaryColor, color: "#ffffff" }}><ServiceGlyph index={index} /><strong style={{ fontSize: 18, lineHeight: 1.15, textTransform: "uppercase" }}>{item.title}</strong><p style={{ margin: "14px 0 0", lineHeight: 1.55, color: "rgba(255,255,255,.8)" }}>{item.description}</p></article>)}</div></div></section> : null}

    {landing.metrics.visible ? <section style={{ borderTop: sectionDivider, padding: `34px ${contentPadding} clamp(72px, 9vw, 112px)`, background: theme.backgroundColor }}><div style={{ maxWidth: 1240, margin: "0 auto" }}>{landing.metrics.eyebrow || landing.metrics.title ? <div style={{ textAlign: "center", marginBottom: 32 }}><Eyebrow color={theme.primaryColor}>{landing.metrics.eyebrow}</Eyebrow>{landing.metrics.title ? <h2 style={{ margin: "14px 0 0", fontSize: "clamp(1.8rem, 3vw, 3rem)", lineHeight: 1 }}>{landing.metrics.title}</h2> : null}</div> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 42 }}>{landing.metrics.items.map((item, index) => <article key={`${item.value}-${index}`} style={{ textAlign: "center" }}><strong style={{ display: "block", color: theme.primaryColor, fontSize: "clamp(2.75rem, 5vw, 4.5rem)", lineHeight: 1, letterSpacing: "-.05em" }}>{item.value}</strong><span style={{ display: "block", marginTop: 10, fontSize: "1.05rem", fontWeight: 800 }}>{item.label}</span>{item.description ? <p style={{ maxWidth: 300, margin: "12px auto 0", lineHeight: 1.55, opacity: .72 }}>{item.description}</p> : null}<span aria-hidden="true" style={{ display: "block", width: 180, maxWidth: "100%", height: 2, margin: "30px auto 0", background: theme.primaryColor }} /></article>)}</div></div></section> : null}

    {landing.story.visible ? <section style={{ borderTop: sectionDivider, padding: `28px ${contentPadding}`, background: theme.backgroundColor }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", alignItems: "stretch", maxWidth: 1480, margin: "0 auto", overflow: "hidden", borderRadius: 28, background: theme.secondaryColor, color: "#ffffff" }}><div>{landing.story.image ? <CampaignMedia landing={landing} url={landing.story.image} fallbackAlt={landing.story.title} presentation={landing.story.imagePresentation} style={{ display: "block", width: "100%", height: "100%", minHeight: 420, maxHeight: 680, objectFit: "cover" }} /> : <div style={{ minHeight: 420, height: "100%", background: "linear-gradient(135deg, rgba(255,255,255,.14), rgba(255,255,255,.02))" }} />}</div><div style={{ padding: "clamp(36px, 6vw, 82px)", alignSelf: "center" }}><Eyebrow color="rgba(255,255,255,.72)">{landing.story.eyebrow}</Eyebrow><h2 style={{ margin: "16px 0", fontSize: "clamp(2rem, 4vw, 3.75rem)", lineHeight: .98, letterSpacing: "-.045em", textTransform: "uppercase" }}>{landing.story.title}</h2><p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.65, color: "rgba(255,255,255,.84)" }}>{landing.story.description}</p><div style={{ display: "grid", gap: 24, marginTop: 34 }}>{landing.story.items.map((item, index) => <article key={`${item.title}-${index}`} style={{ display: "grid", gridTemplateColumns: "42px minmax(0, 1fr)", gap: 14 }}><span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 36, height: 36, marginTop: 2, borderRadius: "50%", background: "rgba(255,255,255,.14)", color: "#ffffff", fontSize: 12, fontWeight: 900 }}>{String(index + 1).padStart(2, "0")}</span><div><strong style={{ display: "block", fontSize: "1.1rem", lineHeight: 1.2, textTransform: "uppercase" }}>{item.title}</strong><p style={{ margin: "7px 0 0", lineHeight: 1.55, color: "rgba(255,255,255,.78)" }}>{item.description}</p></div></article>)}</div><Cta label={landing.story.ctaLabel} href={landing.story.ctaUrl} color="#ffffff" textColor={theme.secondaryColor} /></div></div></section> : null}

    {landing.showcase.visible ? <section style={{ borderTop: sectionDivider, padding: `28px ${contentPadding}`, background: theme.backgroundColor }}><LandingMediaBackground url={landing.showcase.backgroundImage} presentation={landing.showcase.backgroundPresentation} overlay="linear-gradient(90deg, rgba(4,11,25,.92), rgba(9,12,44,.76))" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "clamp(26px, 5vw, 72px)", alignItems: "center", maxWidth: 1480, minHeight: 500, margin: "0 auto", padding: "clamp(36px, 6vw, 84px)", borderRadius: 28, color: "#ffffff", background: theme.secondaryColor }}><div style={{ maxWidth: 430 }}><Eyebrow color="rgba(255,255,255,.72)">{landing.showcase.eyebrow}</Eyebrow><h2 style={{ margin: "16px 0", fontSize: "clamp(2rem, 4vw, 3.75rem)", lineHeight: .98, letterSpacing: "-.045em", textTransform: "uppercase" }}>{landing.showcase.title}</h2><p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.65, color: "rgba(255,255,255,.86)" }}>{landing.showcase.description}</p><Cta label={landing.showcase.ctaLabel} href={landing.showcase.ctaUrl} color="#ffffff" textColor={theme.secondaryColor} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>{landing.showcase.items.map((item, index) => <article key={`${item.title}-${index}`} style={{ display: "grid", alignContent: "center", minHeight: 270, borderRadius: 22, padding: "28px 22px", background: "rgba(255,255,255,.97)", color: theme.textColor, textAlign: "center", boxShadow: "0 14px 36px rgba(0,0,0,.2)" }}><span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 38, height: 38, margin: "0 auto 18px", borderRadius: "50%", background: `${theme.primaryColor}18`, color: theme.primaryColor, fontSize: 13, fontWeight: 900 }}>{String(index + 1).padStart(2, "0")}</span><strong style={{ fontSize: 17, lineHeight: 1.15, textTransform: "uppercase" }}>{item.title}</strong><p style={{ margin: "14px 0 0", lineHeight: 1.55, color: "rgba(17,17,17,.72)" }}>{item.description}</p></article>)}</div></LandingMediaBackground></section> : null}

    {landing.testimonial.visible ? <section style={{ borderTop: sectionDivider, padding: `clamp(76px, 10vw, 132px) ${contentPadding}`, background: theme.backgroundColor }}><div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}><Eyebrow color={theme.primaryColor}>{landing.testimonial.eyebrow}</Eyebrow><h2 style={{ maxWidth: 980, fontSize: "clamp(2rem, 4vw, 3.75rem)", lineHeight: .98, letterSpacing: "-.045em", margin: "16px auto" }}>{landing.testimonial.title}</h2>{landing.testimonial.description ? <p style={{ maxWidth: 1000, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.65, opacity: .8 }}>{landing.testimonial.description}</p> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 18, marginTop: 36, textAlign: "left" }}>{landing.testimonial.items.map((item, index) => <article key={`${item.name}-${index}`} style={{ minHeight: 230, borderRadius: 16, padding: 22, background: "rgba(17,17,17,.045)" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><FeedbackAvatar name={item.name} /><div><strong style={{ display: "block", lineHeight: 1.2 }}>{item.name}</strong><span style={{ display: "block", marginTop: 4, fontSize: 13, opacity: .62 }}>{item.detail}</span></div></div><FeedbackStars rating={item.rating} /><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>“{item.quote}”</p></article>)}</div></div></section> : null}

    {landing.faq.visible ? <CampaignV1Faq faq={landing.faq} theme={theme} sectionDivider={sectionDivider} contentPadding={contentPadding} /> : null}

    {landing.finalCta.visible ? <section style={{ borderTop: sectionDivider, padding: `28px ${contentPadding}`, background: theme.backgroundColor }}><LandingMediaBackground url={landing.finalCta.backgroundImage} presentation={landing.finalCta.backgroundPresentation} overlay="linear-gradient(90deg, rgba(0,0,0,.82), rgba(0,0,0,.58))" style={{ maxWidth: 1480, minHeight: 300, margin: "0 auto", padding: "clamp(42px, 6vw, 80px)", borderRadius: 28, color: "#ffffff", textAlign: "left", background: theme.primaryColor }}><div style={{ maxWidth: 840 }}><Eyebrow color="rgba(255,255,255,.78)">{landing.finalCta.eyebrow}</Eyebrow><h2 style={{ maxWidth: 760, fontSize: "clamp(2.2rem, 5vw, 4.4rem)", lineHeight: .98, letterSpacing: "-.05em", margin: "16px 0" }}>{landing.finalCta.title}</h2><p style={{ maxWidth: 660, fontSize: "1.1rem", lineHeight: 1.7, opacity: .88 }}>{landing.finalCta.description}</p><Cta label={landing.finalCta.ctaLabel} href={landing.finalCta.ctaUrl} color="#ffffff" textColor={theme.primaryColor} /></div></LandingMediaBackground></section> : null}

    <footer style={{ borderTop: sectionDivider, padding: `48px ${contentPadding} 28px`, background: "#111111", color: "#ffffff" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 32, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ maxWidth: 470 }}>
          <strong style={{ fontSize: 21, letterSpacing: ".01em" }}>Rodogarcia Transportes</strong>
          <p style={{ margin: "12px 0 0", lineHeight: 1.65, color: "rgba(255,255,255,.72)" }}>Uma operação com transparência, privacidade e respeito aos seus dados.</p>
        </div>
        <nav aria-label="Informações legais" style={{ display: "flex", flexWrap: "wrap", alignContent: "start", gap: "12px 20px", fontSize: 14 }}>
          <a href="/privacidade" style={{ color: "#ffffff", textUnderlineOffset: 3 }}>Privacidade e LGPD</a>
          <a href="/termos-de-uso" style={{ color: "#ffffff", textUnderlineOffset: 3 }}>Termos de uso</a>
          <LandingCookieSettingsButton />
        </nav>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, maxWidth: 1280, margin: "34px auto 0", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.18)", color: "rgba(255,255,255,.62)", fontSize: 13, lineHeight: 1.5 }}>
        <span>© {new Date().getFullYear()} Rodogarcia. Todos os direitos reservados.</span>
        <a href="https://www.linkedin.com/in/dev-lucasandrade/" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textUnderlineOffset: 3 }}>Desenvolvido por Lucas Andrade</a>
      </div>
    </footer>
  </main>;
}
