"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChatCircleDots, CheckCircle } from "@phosphor-icons/react";
import { site } from "@/lib/routes";

const BENEFITS = [
  "Resposta rápida",
  "Cobertura nacional",
  "Operação monitorada",
] as const;

export default function FinalQuoteCtaSection() {
  return (
    <section
      className="relative py-10 sm:py-12"
      aria-labelledby="final-cta-title"
    >
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="rounded-[28px] bg-slate-950 px-6 py-7 text-white shadow-[0_20px_48px_rgba(15,23,42,0.16)] sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Cotação rápida</p>
              <h2 id="final-cta-title" className="mt-2 text-[clamp(1.8rem,3vw,2.7rem)] font-bold leading-[1.02] tracking-[-0.045em]">Vamos calcular sua carga?</h2>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-white/65 sm:text-base">Preencha os dados para cotar agora ou fale com um especialista.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center lg:flex-col lg:items-stretch">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} className="min-w-0 sm:w-auto">
                <Link
                  href={site.quote}
                  className="inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(29,78,216,0.22)] transition-colors hover:bg-[var(--color-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/24 sm:w-auto sm:px-7"
                >
                  <span className="min-w-0 truncate">Solicitar cotação</span>
                  <ArrowRight size={18} weight="bold" className="shrink-0" />
                </Link>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} className="min-w-0 sm:w-auto">
                <Link
                  href={site.contact}
                  className="inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(4,120,87,0.3)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-[0_22px_52px_rgba(6,95,70,0.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto sm:px-7"
                >
                  <span className="min-w-0 truncate">Falar com especialista</span>
                  <ChatCircleDots size={18} weight="bold" className="shrink-0" />
                </Link>
              </motion.div>
            </div>
          </div>
          <ul className="mt-5 grid gap-1.5 border-t border-white/10 pt-4 text-xs text-white/70 sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2 sm:pt-5 sm:text-sm sm:text-white/60">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
                <CheckCircle size={16} weight="fill" className="text-sky-300" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
