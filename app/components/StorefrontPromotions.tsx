"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Copy, Megaphone, Share2 } from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";
import type { PublicPromotion, Tenant } from "@/app/types";

export function StorefrontPromotions({
  tenant,
  promotions,
  selectedPromotionId,
}: {
  tenant: Tenant;
  promotions: PublicPromotion[];
  selectedPromotionId?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const sharePromotion = async (promotion: PublicPromotion) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "promotions");
    url.searchParams.set("promotion", promotion.id);
    const shareData = {
      title: `${promotion.name} | ${tenant.name}`,
      text: promotion.description || `See ${promotion.name} at ${tenant.name}.`,
      url: url.toString(),
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    await copyText(shareData.url, `share-${promotion.id}`);
  };

  return (
    <section aria-labelledby="promotions-heading" className="space-y-6">
      <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-[#0d1728] to-[#08111f] px-5 py-7 sm:px-8 light:from-violet-100 light:via-white light:to-white">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/20 text-violet-300 light:text-violet-700">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-300 light:text-violet-700">
              Current offers
            </p>
            <h2 id="promotions-heading" className="text-2xl font-black">
              Promotions from {tenant.name}
            </h2>
          </div>
        </div>
      </div>

      {promotions.length === 0 ? (
        <div className="rounded-3xl border border-[#24334a] bg-[#0b1525] p-10 text-center text-slate-400 light:border-slate-200 light:bg-white light:text-slate-600">
          There are no active promotions right now. Please check again soon.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {promotions.map((promotion) => {
            const selected = promotion.id === selectedPromotionId;
            const discount =
              promotion.discountType === "PERCENTAGE"
                ? `${promotion.discountValue}% off`
                : `${formatCurrency(promotion.discountValue)} off`;
            return (
              <article
                id={`promotion-${promotion.id}`}
                key={promotion.id}
                className={`overflow-hidden rounded-3xl border bg-[#0b1525] shadow-xl transition light:bg-white ${selected ? "border-violet-400 ring-4 ring-violet-500/15" : "border-[#24334a] light:border-slate-200"}`}
              >
                {promotion.flyerUrl ? (
                  <div className="relative aspect-[4/5] w-full bg-[#101b2d] light:bg-slate-100">
                    <Image
                      src={promotion.flyerUrl}
                      alt={`${promotion.name} promotion flyer`}
                      fill
                      className="object-contain"
                      sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="grid aspect-[16/8] place-items-center bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 text-center text-3xl font-black text-white">
                    {discount}
                  </div>
                )}
                <div className="space-y-4 p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-black">{promotion.name}</h3>
                      <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300 light:text-emerald-700">
                        {discount}
                      </span>
                    </div>
                    {promotion.description && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400 light:text-slate-600">
                        {promotion.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(promotion.code, promotion.id)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-violet-400/50 bg-violet-500/10 px-4 text-sm font-black text-violet-200 light:text-violet-700"
                    >
                      {copied === promotion.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {promotion.code}
                    </button>
                    <button
                      type="button"
                      onClick={() => sharePromotion(promotion)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500"
                    >
                      {copied === `share-${promotion.id}` ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                      {copied === `share-${promotion.id}`
                        ? "Link copied"
                        : "Share"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
