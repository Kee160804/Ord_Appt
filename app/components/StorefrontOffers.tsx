"use client";

import { BadgePercent, TicketPercent } from "lucide-react";

import { formatCurrency } from "@/app/lib/utils";
import type { PublicPromotion } from "@/app/types";

interface StorefrontOffersProps {
  promotions: PublicPromotion[];
  automaticDiscount?: {
    rate: number;
    threshold: number;
  };
  onSelectCode?: (code: string) => void;
}

function promotionValue(promotion: PublicPromotion) {
  return promotion.discountType === "PERCENTAGE"
    ? `${promotion.discountValue}% off`
    : `${formatCurrency(promotion.discountValue)} off`;
}

export function StorefrontOffers({
  promotions,
  automaticDiscount,
  onSelectCode,
}: StorefrontOffersProps) {
  if (!automaticDiscount && promotions.length === 0) return null;

  return (
    <section
      className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/8 p-3 light:border-emerald-200 light:bg-emerald-50"
      aria-label="Storefront discounts"
    >
      <div className="flex items-center gap-2 text-xs font-black text-emerald-300 light:text-emerald-800">
        <BadgePercent className="h-4 w-4" /> Current offers
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {automaticDiscount && (
          <div className="rounded-xl border border-emerald-400/20 bg-[#0b1722]/65 px-3 py-2 light:border-emerald-200 light:bg-white">
            <p className="text-xs font-black text-white light:text-slate-950">
              {automaticDiscount.rate}% automatic discount
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-200/80 light:text-emerald-700">
              Spend {formatCurrency(automaticDiscount.threshold)} or more
            </p>
          </div>
        )}
        {promotions.map((promotion) => {
          const targeted =
            promotion.applicableProductIds.length > 0 ||
            promotion.applicableServiceIds.length > 0;
          const content = (
            <>
              <span className="flex items-center gap-1.5 text-xs font-black text-white light:text-slate-950">
                <TicketPercent className="h-3.5 w-3.5 text-violet-300 light:text-violet-600" />
                {promotionValue(promotion)}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-300 light:text-slate-600">
                Use <strong>{promotion.code}</strong>
                {targeted ? " on eligible items" : " storewide"} ·{" "}
                {promotion.name}
              </span>
            </>
          );

          return onSelectCode ? (
            <button
              key={promotion.id}
              type="button"
              onClick={() => onSelectCode(promotion.code)}
              className="rounded-xl border border-violet-400/25 bg-[#0b1722]/65 px-3 py-2 text-left transition hover:border-violet-400 hover:bg-violet-500/10 light:border-violet-200 light:bg-white light:hover:bg-violet-50"
              aria-label={`Use discount code ${promotion.code}`}
            >
              {content}
            </button>
          ) : (
            <div
              key={promotion.id}
              className="rounded-xl border border-violet-400/25 bg-[#0b1722]/65 px-3 py-2 light:border-violet-200 light:bg-white"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
