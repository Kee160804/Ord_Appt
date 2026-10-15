import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import type { Tenant } from "@/app/types";

export function StorefrontAbout({ tenant }: { tenant: Tenant }) {
  const about = tenant.aboutInfo?.trim() || tenant.description;

  return (
    <section
      className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
      aria-labelledby="about-heading"
    >
      <article className="rounded-3xl border border-[#24334a] bg-[#0b1525] p-6 sm:p-9 light:border-slate-200 light:bg-white">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-300 light:text-violet-700">
          Our story
        </p>
        <h2 id="about-heading" className="mt-2 text-3xl font-black">
          About {tenant.name}
        </h2>
        <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-300 light:text-slate-700">
          {about}
        </p>
      </article>

      <aside className="rounded-3xl border border-[#24334a] bg-[#0b1525] p-6 light:border-slate-200 light:bg-white">
        <h3 className="text-lg font-black">Business details</h3>
        <div className="mt-5 space-y-4 text-sm text-slate-300 light:text-slate-700">
          {(tenant.address || tenant.city) && (
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
              <span>
                {[tenant.address, tenant.city].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {tenant.phone && (
            <a
              href={`tel:${tenant.phone}`}
              className="flex gap-3 hover:text-violet-300"
            >
              <Phone className="h-5 w-5 shrink-0 text-violet-400" />
              <span>{tenant.phone}</span>
            </a>
          )}
          {tenant.email && (
            <a
              href={`mailto:${tenant.email}`}
              className="flex gap-3 hover:text-violet-300"
            >
              <Mail className="h-5 w-5 shrink-0 text-violet-400" />
              <span className="break-all">{tenant.email}</span>
            </a>
          )}
          <div className="flex gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
            <div className="w-full space-y-2">
              {tenant.businessHours.map((hours) => (
                <div key={hours.day} className="flex justify-between gap-4">
                  <span>{hours.day}</span>
                  <span className="text-right text-slate-400 light:text-slate-600">
                    {hours.closed ? "Closed" : `${hours.open}–${hours.close}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
