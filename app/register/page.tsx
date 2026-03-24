"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Calendar, ShoppingBag, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";
import type { BusinessType } from "../types/index";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [bType, setBType] = useState<BusinessType | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", businessName: "", city: "", phone: "", slug: "" });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setLoading(true);
    // Simulate API call – replace with actual registration logic
    await new Promise(r => setTimeout(r, 1200));
    // Redirect to login page so user can sign in with new credentials
    router.push("/login");
  };

  const steps = ["Account", "Business Type", "Business Details"];

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 bg-violet-600/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <span className="font-black text-xl text-white">LocalSpace</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white">Create your business</h1>
          <p className="text-slate-500 text-sm mt-1">Set up your digital storefront in minutes</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 px-2">
          {steps.map((s, i) => {
            const num = i + 1;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all flex-shrink-0",
                  step > num ? "bg-emerald-500 text-white" : step === num ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-500 border border-slate-700",
                )}>
                  {step > num ? <Check className="w-4 h-4" /> : num}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("flex-1 h-0.5 mx-2 rounded-full transition-all", step > num ? "bg-emerald-500" : "bg-slate-800")} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 shadow-xl shadow-black/30">
          {/* Step 1: Account */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div><h2 className="text-lg font-black text-white">Your account</h2><p className="text-sm text-slate-500 mt-0.5">Start with your personal details</p></div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" placeholder="Jane" value={form.firstName} onChange={v => update("firstName", v)} />
                <Field label="Last Name" placeholder="Smith" value={form.lastName} onChange={v => update("lastName", v)} />
              </div>
              <Field label="Email" type="email" placeholder="jane@business.com" value={form.email} onChange={v => update("email", v)} />
              <Field label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={v => update("password", v)} />
              <div className="flex gap-3">
                <button
                  onClick={() => router.back()}
                  className="flex-1 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Business type */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div><h2 className="text-lg font-black text-white">Business type</h2><p className="text-sm text-slate-500 mt-0.5">What kind of business are you running?</p></div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: "appointment" as BusinessType, icon: Calendar, label: "Appointments", desc: "Salons, barbers, clinics, studios", color: "violet", examples: ["💅 Nail salons", "💈 Barbershops", "🧘 Yoga studios"] },
                  { type: "ordering" as BusinessType, icon: ShoppingBag, label: "Ordering", desc: "Restaurants, bakeries, cafes", color: "orange", examples: ["🍕 Restaurants", "🥐 Bakeries", "☕ Cafes"] },
                ].map(opt => {
                  const Icon = opt.icon;
                  const sel = bType === opt.type;
                  const isViolet = opt.color === "violet";
                  return (
                    <button key={opt.type} onClick={() => setBType(opt.type)}
                      className={cn("p-5 rounded-2xl border-2 text-left space-y-3 transition-all",
                        sel
                          ? isViolet ? "border-violet-500 bg-violet-900/30" : "border-orange-500 bg-orange-900/30"
                          : "border-slate-700 hover:border-slate-500 bg-slate-800/30")}>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isViolet ? "bg-violet-500/20" : "bg-orange-500/20")}>
                        <Icon className={cn("w-5 h-5", isViolet ? "text-violet-400" : "text-orange-400")} />
                      </div>
                      <div>
                        <p className="font-black text-white text-sm">{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className="space-y-1">{opt.examples.map(e => <p key={e} className="text-xs text-slate-500">{e}</p>)}</div>
                      {sel && <p className={cn("text-xs font-bold flex items-center gap-1", isViolet ? "text-violet-400" : "text-orange-400")}><Check className="w-3 h-3" /> Selected</p>}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => bType && setStep(3)} disabled={!bType}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Business details */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div><h2 className="text-lg font-black text-white">Business details</h2><p className="text-sm text-slate-500 mt-0.5">Your public storefront information</p></div>
              <Field label="Business Name" placeholder="e.g. Luxe Beauty Studio" value={form.businessName} onChange={v => update("businessName", v)} />
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Storefront URL</label>
                <div className="flex items-center">
                  <span className="text-sm text-slate-500 bg-slate-700/50 border border-slate-600 rounded-l-xl px-3 py-2.5 border-r-0 whitespace-nowrap">localspace.io/</span>
                  <input value={form.slug} onChange={e => update("slug", e.target.value)} placeholder="your-business"
                    className="flex-1 px-4 py-2.5 border border-slate-600 rounded-r-xl text-sm bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" placeholder="Miami, FL" value={form.city} onChange={v => update("city", v)} />
                <Field label="Phone" type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={v => update("phone", v)} />
              </div>
              <div className="p-4 bg-violet-900/20 border border-violet-500/20 rounded-xl text-sm text-violet-300">
                <p className="font-bold mb-1">🎉 You&apos;re almost there!</p>
                <p className="text-violet-400/70">Your {bType === "appointment" ? "appointment booking" : "online ordering"} storefront will be live instantly after signup.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={submit} disabled={loading}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</> : <>Launch Business 🚀</>}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-400 font-bold hover:text-violet-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, type = "text", placeholder, value, onChange }: { label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 text-sm border border-slate-600 rounded-xl bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600" />
    </div>
  );
}