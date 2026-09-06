"use client";


import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface ComplianceContent {
  image: {
    src: string;
    alt: string;
  };
  title: string;
  description: string;
  certificateText: string;
  certificateUrl?: string;
  certifications?: Array<{
    title: string;
    description: string;
    image: { src: string; alt: string };
    certificateUrl?: string;
  }>;
}

interface CertificationItem {
  title: string;
  description: string;
  image: string;
  alt?: string;
  url?: string;
}

const CERTIFICATIONS: CertificationItem[] = [
  {
    title: "ISO 9001",
    description: "Gestão da qualidade aplicada em cada camada da operação.",
    image: "/certificados/iso-9001.9371c4a6c19f.webp",
  },
  {
    title: "SASSMAQ",
    description: "Segurança, saúde e meio ambiente em processos sensíveis.",
    image: "/certificados/certificado-sassmaq.webp",
  },
  {
    title: "EcoVadis",
    description: "Maturidade em sustentabilidade e responsabilidade corporativa.",
    image: "/certificados/ecovadis.webp",
  },
  {
    title: "Licença PF",
    description: "Autorização para operações que exigem controles adicionais.",
    image: "/certificados/pf.webp",
  },
  {
    title: "Polícia Civil SP",
    description: "Habilitação estadual alinhada a operações com governança ampliada.",
    image: "/certificados/policia-civil-sp.57269b3e1bdd.webp",
  },
  {
    title: "Exército Brasileiro",
    description: "Autorização conectada a rotinas com requisitos extras de controle.",
    image: "/certificados/exercito-br.webp",
  },
  {
    title: "IBAMA",
    description: "Conformidade e controle rigoroso em operações com impacto e regulamentação ambiental.",
    image: "/certificados/ibama.7198f261a1ee.webp",
  },
];

const getCertImageClass = (title: string) => {
  const base = "w-auto max-w-full object-contain drop-shadow-xl transition-all duration-300";
  return `h-[26vh] sm:h-[30vh] md:h-[28vh] lg:h-[30vh] xl:h-[32vh] max-h-[400px] ${base}`;
};



export function ComplianceSection({ content }: { content?: ComplianceContent }) {
  const cmsCertification =
    content?.image?.src && content.title
      ? {
          title: content.certificateText || content.title,
          description: content.description,
          image: content.image.src,
          alt: content.image.alt || content.title,
          url: content.certificateUrl,
        }
      : null;
  const certifications = content?.certifications?.length
    ? content.certifications.map((item) => ({
        title: item.title,
        description: item.description,
        image: item.image.src,
        alt: item.image.alt || item.title,
        url: item.certificateUrl,
      }))
    : cmsCertification
    ? [
        cmsCertification,
        ...CERTIFICATIONS.filter((item) => item.image !== cmsCertification.image),
      ]
    : CERTIFICATIONS;

  return (
    <CertificationScroller
      certifications={certifications}
      eyebrow="Governança & Compliance"
      title={content?.title || "Excelência em cada operação"}
    />
  );
}

function CertificationScroller({
  certifications,
  eyebrow,
  title,
}: {
  certifications: CertificationItem[];
  eyebrow: string;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalSlides = certifications.length;
  const [currentIdx, setCurrentIdx] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const goToCertification = useCallback(
    (index: number) => {
      if (index >= totalSlides) {
        const sectionTop = containerRef.current?.offsetTop;
        const sectionHeight = containerRef.current?.offsetHeight;
        if (typeof sectionTop === "number" && typeof sectionHeight === "number") {
          window.scrollTo({
            top: sectionTop + sectionHeight,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
        }
        return;
      }

      const boundedIndex = Math.max(0, index);
      setCurrentIdx(boundedIndex);

      const sectionTop = containerRef.current?.offsetTop;
      if (typeof sectionTop !== "number") return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: sectionTop + boundedIndex * window.innerHeight,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [totalSlides]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) return;

        const index = Number(
          visibleEntries[visibleEntries.length - 1].target.getAttribute("data-index")
        );

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
          setCurrentIdx(index);
        }, 150);
      },
      {
        root: null,
        rootMargin: "-45% 0px -45% 0px",
      }
    );

    const ghosts = containerRef.current?.querySelectorAll(".ghost-block");
    ghosts?.forEach((ghost) => observer.observe(ghost));

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);



  return (
    <section
      ref={containerRef}
      className="relative bg-[#020617] text-white"
      style={{ height: `${totalSlides * 100}vh` }}
    >
      <div className="pointer-events-none absolute left-0 right-0 top-0 w-full">
        {certifications.map((_, index) => (
          <div
            key={`ghost-${index}`}
            className="ghost-block h-screen w-full"
            data-index={index}
          />
        ))}
      </div>

      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15)_0%,rgba(2,6,23,1)_70%)]" />
        <div className="decorative-grid absolute inset-0" data-theme="dark" />

        <div
          className="pointer-events-none absolute inset-0 z-50 opacity-[0.02]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_150px_rgba(2,6,23,0.8)]" />

        <div className="pointer-events-none absolute left-0 right-0 top-24 z-40 px-6 text-center sm:top-32">
          <div className="mb-3 inline-flex items-center gap-3">
            <span className="h-px w-6 bg-sky-500" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 sm:text-xs">
              {eyebrow}
            </h2>
            <span className="h-px w-6 bg-sky-500" />
          </div>
          <h3 className="mb-2 text-xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-4xl">
            {title}
          </h3>
        </div>

        <div className="relative z-10 mx-auto h-full w-full max-w-7xl">
          <AnimatePresence>
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-16 pt-40 md:px-12 md:pb-20 md:pt-48"
            >
              <div
                className="relative z-10 flex w-full flex-col items-center justify-center rounded-2xl text-center outline-none"
              >
                <div className="mb-4 flex w-full items-center justify-center sm:mb-5 md:mb-6">
                  <img
                    src={certifications[currentIdx].image}
                    alt={certifications[currentIdx].alt || certifications[currentIdx].title}
                    className={getCertImageClass(certifications[currentIdx].title)}
                  />
                </div>
                <div className="flex w-full shrink-0 flex-col items-center px-4">
                  {/* w-full max-w-[30ch] text-balance garante estabilidade e evita quebra excessiva de titulos longos */}
                  <h3 className="mx-auto mb-2 w-full max-w-[30ch] text-balance text-2xl font-extrabold leading-[1.05] tracking-[-0.01em] text-white drop-shadow-lg sm:mb-2.5 sm:text-3xl md:text-4xl lg:text-[2.8rem]">
                    {certifications[currentIdx].title}
                  </h3>
                  <p className="mx-auto max-w-[540px] text-sm leading-relaxed text-white/80 sm:text-base md:text-[15px]">
                    {certifications[currentIdx].description}
                  </p>
                  {certifications[currentIdx].url ? (
                    <a
                      href={certifications[currentIdx].url}
                      target={certifications[currentIdx].url?.startsWith("http") ? "_blank" : undefined}
                      rel={certifications[currentIdx].url?.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-sky-300/30 bg-sky-400/10 px-5 text-xs font-bold uppercase tracking-[0.14em] text-sky-200 transition-colors hover:bg-sky-400/20"
                    >
                      Ver certificado
                    </a>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-between sm:flex sm:inset-x-6 lg:inset-x-10">
          <CertificateNavButton
            label="Certificado anterior"
            direction="previous"
            onClick={() => goToCertification(currentIdx - 1)}
          />
          <CertificateNavButton
            label="Próximo certificado"
            direction="next"
            onClick={() => goToCertification(currentIdx + 1)}
          />
        </div>

        <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-40 flex flex-col items-center gap-3 sm:bottom-10">
          <div className="font-mono text-xs font-medium tracking-widest text-white/60 sm:text-sm">
            {String(currentIdx + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
          </div>
          <div className="flex gap-2">
            {certifications.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentIdx ? "w-8 bg-sky-400" : "w-2 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}

function CertificateNavButton({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.075] text-white/82 shadow-[0_12px_28px_rgba(2,6,23,0.24)] backdrop-blur-md transition-[background-color,border-color,transform,color] duration-200 ease-out hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/16 sm:h-12 sm:w-12"
    >
      {direction === "previous" ? (
        <CaretLeft size={22} weight="bold" aria-hidden="true" />
      ) : (
        <CaretRight size={22} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}
