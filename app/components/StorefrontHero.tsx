"use client";

import { parseStorefrontDesign } from "@/app/lib/storefront-design";
import type { Tenant } from "@/app/types";

export function StorefrontHero({
  tenant,
  imageUrl,
  compact = false,
  onAction,
}: {
  tenant: Tenant;
  imageUrl?: string;
  compact?: boolean;
  onAction?: () => void;
}) {
  const design = parseStorefrontDesign(
    tenant.storefrontDesign,
    tenant.businessType,
  );
  if (!design.sections.hero) return null;

  const cover = imageUrl || tenant.coverImage || "/fallback-product.png";
  const align =
    design.heroAlignment === "center"
      ? "items-center text-center"
      : design.heroAlignment === "right"
        ? "items-end text-right"
        : "items-start text-left";
  const imageFit = design.heroStyle === "full" ? "object-cover" : "object-contain";
  const zoom =
    design.heroStyle === "close-up"
      ? Math.max(150, tenant.coverImageZoom ?? 100)
      : tenant.coverImageZoom ?? 100;

  return (
    <section
      className={`relative w-full overflow-hidden border border-slate-700/80 bg-[#081423] shadow-2xl ${compact ? "min-h-44 rounded-xl" : "min-h-64 rounded-2xl"}`}
      style={{
        background:
          design.backgroundStyle === "gradient"
            ? `linear-gradient(135deg, ${tenant.primaryColor}55, #07111f 58%, ${tenant.accentColor}35)`
            : design.backgroundStyle === "light"
              ? "#f8fafc"
              : "#081423",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={`${tenant.name} cover`}
        className={`absolute inset-0 h-full w-full ${imageFit}`}
        style={{
          objectPosition: `${tenant.coverImagePositionX ?? 50}% ${tenant.coverImagePositionY ?? 50}%`,
          transform: `scale(${zoom / 100})`,
        }}
      />
      <div className="absolute inset-0 bg-linear-to-r from-[#06101e]/95 via-[#06101e]/58 to-transparent" />
      <div
        className={`relative flex min-h-[inherit] max-w-full flex-col justify-center ${align} ${compact ? "p-5" : "p-7 sm:p-10"}`}
      >
        <h2
          className={`max-w-xl font-black leading-[1.02] tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,.72)] ${compact ? "text-2xl" : "text-4xl sm:text-5xl"}`}
        >
          {design.heroHeading}
          {design.heroAccent && (
            <>
              <br />
              <span style={{ color: tenant.accentColor }}>
                {design.heroAccent}
              </span>
            </>
          )}
        </h2>
        <p
          className={`mt-3 max-w-lg text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.72)] ${compact ? "text-[10px]" : "text-sm leading-6"}`}
        >
          {design.heroSubheading || tenant.description}
        </p>
        <button
          type="button"
          onClick={onAction}
          className={`mt-4 rounded-lg font-black text-white shadow-lg transition hover:brightness-110 ${compact ? "px-3 py-2 text-[9px]" : "px-5 py-3 text-xs"}`}
          style={{ backgroundColor: tenant.primaryColor }}
        >
          {design.heroCtaLabel} →
        </button>
      </div>
    </section>
  );
}
