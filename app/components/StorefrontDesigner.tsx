"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Contact,
  ExternalLink,
  ImageIcon,
  LayoutTemplate,
  Mail,
  MapPin,
  Monitor,
  Palette,
  Phone,
  Search,
  Smartphone,
  Upload,
} from "lucide-react";
import { BusinessLogo } from "@/app/components/BusinessLogo";
import { StorefrontHero } from "@/app/components/StorefrontHero";
import { useTheme } from "@/app/contexts/theme";
import { Input, Textarea } from "@/app/components/input";
import { cn } from "@/app/lib/utils";
import {
  parseStorefrontDesign,
  STOREFRONT_SOCIAL_PLATFORMS,
} from "@/app/lib/storefront-design";
import {
  deleteStorefrontCoverImage,
  updateBusinessDetails,
  updateStorefrontSettings,
  uploadBusinessLogo,
  uploadStorefrontCoverImage,
  validateBusinessLogo,
  validateStorefrontCoverImage,
} from "@/app/services/settingsService";
import type { SocialPlatform, StorefrontDesign, Tenant } from "@/app/types";

type EditorTab = "design" | "content" | "branding" | "contact" | "seo";
type PreviewTheme = "dark" | "light";

const TABS: { id: EditorTab; label: string; icon: typeof Palette }[] = [
  { id: "design", label: "Design", icon: Palette },
  { id: "content", label: "Content", icon: LayoutTemplate },
  { id: "branding", label: "Branding", icon: ImageIcon },
  { id: "contact", label: "Contact", icon: Contact },
  { id: "seo", label: "SEO / Domain", icon: Search },
];

const SOCIAL_EDITOR_PLATFORMS: Array<{
  key: SocialPlatform;
  label: string;
  placeholder: string;
}> = [
  { key: "instagram", label: "Instagram", placeholder: "@business or URL" },
  { key: "facebook", label: "Facebook", placeholder: "Page name or URL" },
  { key: "tiktok", label: "TikTok", placeholder: "@business or URL" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "Phone number or URL" },
  { key: "youtube", label: "YouTube", placeholder: "Channel name or URL" },
  { key: "twitter", label: "X / Twitter", placeholder: "@business or URL" },
];

export function StorefrontDesigner({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<EditorTab>("design");
  const [contactSection, setContactSection] = useState<
    "content" | "details" | "social"
  >("content");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [slug, setSlug] = useState(tenant.slug);
  const [coverImage, setCoverImage] = useState(tenant.coverImage);
  const [logoImage, setLogoImage] = useState(tenant.logoImage ?? "");
  const [coverPositionX, setCoverPositionX] = useState(
    tenant.coverImagePositionX ?? 50,
  );
  const [coverPositionY, setCoverPositionY] = useState(
    tenant.coverImagePositionY ?? 50,
  );
  const [coverZoom, setCoverZoom] = useState(tenant.coverImageZoom ?? 100);
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor);
  const [accentColor, setAccentColor] = useState(tenant.accentColor);
  const [socialLinks, setSocialLinks] = useState(tenant.socialLinks);
  const [contactDetails, setContactDetails] = useState({
    phone: tenant.phone,
    email: tenant.email,
    address: tenant.address,
    city: tenant.city,
  });
  const [design, setDesign] = useState(() =>
    parseStorefrontDesign(tenant.storefrontDesign, tenant.businessType),
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const coverUrlRef = useRef("");
  const logoUrlRef = useRef("");

  useEffect(
    () => () => {
      if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    },
    [],
  );

  const selectFile = (kind: "cover" | "logo", file?: File) => {
    if (!file) return;
    try {
      if (kind === "cover") validateStorefrontCoverImage(file);
      else validateBusinessLogo(file);
      const url = URL.createObjectURL(file);
      if (kind === "cover") {
        if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = url;
        setCoverFile(file);
        setCoverPreview(url);
      } else {
        if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
        logoUrlRef.current = url;
        setLogoFile(file);
        setLogoPreview(url);
      }
      setError("");
      setSuccess("");
    } catch (fileError) {
      setError(
        fileError instanceof Error ? fileError.message : "Invalid image.",
      );
    }
  };

  const updateDesign = <K extends keyof StorefrontDesign>(
    key: K,
    value: StorefrontDesign[K],
  ) => setDesign((current) => ({ ...current, [key]: value }));

  const previewTenant: Tenant = {
    ...tenant,
    slug,
    coverImage: coverPreview || coverImage,
    logoImage: logoPreview || logoImage || undefined,
    coverImagePositionX: coverPositionX,
    coverImagePositionY: coverPositionY,
    coverImageZoom: coverZoom,
    primaryColor,
    accentColor,
    socialLinks,
    ...contactDetails,
    storefrontDesign: design,
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    let uploadedCover = "";
    try {
      if (design.contactMapUrl.trim()) {
        let mapsUrl: URL;
        try {
          mapsUrl = new URL(design.contactMapUrl.trim());
        } catch {
          throw new Error("Paste a valid Maps share URL.");
        }
        if (mapsUrl.protocol !== "https:" && mapsUrl.protocol !== "http:") {
          throw new Error("The Maps share link must use HTTP or HTTPS.");
        }
      }
      if (coverFile) {
        uploadedCover = await uploadStorefrontCoverImage(tenant.id, coverFile);
      }
      const uploadedLogo = logoFile
        ? await uploadBusinessLogo(tenant.id, logoFile)
        : logoImage;
      const [saved, savedBusiness] = await Promise.all([
        updateStorefrontSettings(tenant.id, {
          slug,
          storefrontUrlEditAllowed: tenant.storefrontUrlEditAllowed === true,
          existingCustomDomain: tenant.customDomain,
          coverImage: uploadedCover || coverImage,
          coverImagePositionX: coverPositionX,
          coverImagePositionY: coverPositionY,
          coverImageZoom: coverZoom,
          primaryColor,
          accentColor,
          socialLinks,
          storefrontDesign: design,
        }),
        updateBusinessDetails(tenant.id, {
          name: tenant.name,
          description: tenant.description,
          aboutInfo: tenant.aboutInfo ?? "",
          ...contactDetails,
        }),
      ]);
      const nextTenant: Tenant = {
        ...tenant,
        ...savedBusiness,
        ...saved,
        logoImage: uploadedLogo || undefined,
        domain: saved.customDomain,
      };
      setCoverImage(saved.coverImage);
      setLogoImage(uploadedLogo);
      setCoverFile(null);
      setLogoFile(null);
      setCoverPreview("");
      setLogoPreview("");
      onTenantUpdated(nextTenant);
      if (uploadedCover && tenant.coverImage !== uploadedCover) {
        await deleteStorefrontCoverImage(tenant.id, tenant.coverImage);
      }
      setSuccess("Your storefront design is live.");
    } catch (saveError) {
      if (uploadedCover) {
        await deleteStorefrontCoverImage(tenant.id, uploadedCover);
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save storefront settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = `/store-front/${slug || tenant.slug}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0b1525] shadow-xl light:border-slate-200 light:bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-4 light:border-slate-200 sm:px-5">
        <div>
          <h3 className="text-lg font-black text-white light:text-slate-950">
            Storefront Settings
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Design your store and preview exactly what customers will see.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-200 hover:border-violet-400 light:text-slate-700"
          >
            View Storefront <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-700/70 px-2 light:border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold",
                activeTab === tab.id
                  ? "border-violet-500 text-violet-300 light:text-violet-700"
                  : "border-transparent text-slate-400 hover:text-white light:hover:text-slate-900",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 p-3 xl:grid-cols-[minmax(320px,0.88fr)_minmax(440px,1.12fr)]">
        <div className="space-y-3">
          {activeTab === "design" && (
            <>
              <Panel
                title="Header / Hero image"
                hint="JPG, PNG or WebP · max 5 MB"
              >
                <ImagePicker
                  id="storefront-cover-new"
                  src={coverPreview || coverImage}
                  label="Change hero image"
                  onSelect={(file) => selectFile("cover", file)}
                />
                <ChoiceRow
                  label="Hero style"
                  value={design.heroStyle}
                  options={[
                    ["full", "Full width"],
                    ["balanced", "Balanced"],
                    ["close-up", "Close-up"],
                  ]}
                  onChange={(value) =>
                    updateDesign(
                      "heroStyle",
                      value as StorefrontDesign["heroStyle"],
                    )
                  }
                />
                <ChoiceRow
                  label="Text alignment"
                  value={design.heroAlignment}
                  options={[
                    ["left", "Left"],
                    ["center", "Center"],
                    ["right", "Right"],
                  ]}
                  onChange={(value) =>
                    updateDesign(
                      "heroAlignment",
                      value as StorefrontDesign["heroAlignment"],
                    )
                  }
                />
                <Range
                  label="Image left / right"
                  value={coverPositionX}
                  min={0}
                  max={100}
                  onChange={setCoverPositionX}
                />
                <Range
                  label="Image up / down"
                  value={coverPositionY}
                  min={0}
                  max={100}
                  onChange={setCoverPositionY}
                />
                <Range
                  label="Image zoom"
                  value={coverZoom}
                  min={100}
                  max={200}
                  suffix="%"
                  onChange={setCoverZoom}
                />
              </Panel>
              <Panel
                title="Storefront layout"
                hint="Choose which sections customers can see."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(design.sections).map(([key, enabled]) => (
                    <Toggle
                      key={key}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      checked={enabled}
                      onChange={(checked) =>
                        updateDesign("sections", {
                          ...design.sections,
                          [key]: checked,
                        })
                      }
                    />
                  ))}
                </div>
              </Panel>
            </>
          )}

          {activeTab === "content" && (
            <Panel
              title="Hero content"
              hint="Write the message customers see first."
            >
              <Input
                label="Heading"
                value={design.heroHeading}
                maxLength={80}
                onChange={(event) =>
                  updateDesign("heroHeading", event.target.value)
                }
              />
              <Input
                label="Highlighted line"
                value={design.heroAccent}
                maxLength={80}
                onChange={(event) =>
                  updateDesign("heroAccent", event.target.value)
                }
              />
              <Textarea
                label="Subheading"
                value={design.heroSubheading}
                maxLength={180}
                rows={3}
                placeholder={tenant.description}
                onChange={(event) =>
                  updateDesign("heroSubheading", event.target.value)
                }
              />
              <Input
                label="Button label"
                value={design.heroCtaLabel}
                maxLength={30}
                onChange={(event) =>
                  updateDesign("heroCtaLabel", event.target.value)
                }
              />
            </Panel>
          )}

          {activeTab === "branding" && (
            <>
              <Panel
                title="Business logo"
                hint="Shown in the storefront header. Max 2 MB."
              >
                <div className="flex items-center gap-4">
                  <BusinessLogo
                    tenant={previewTenant}
                    className="h-16 w-16 rounded-xl text-xl font-black"
                  />
                  <ImageUploadButton
                    id="storefront-logo-new"
                    label="Upload logo"
                    onSelect={(file) => selectFile("logo", file)}
                  />
                </div>
              </Panel>
              <Panel
                title="Theme colours"
                hint="Use colours that match your brand."
              >
                <ColorField
                  label="Primary colour"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />
                <ColorField
                  label="Accent colour"
                  value={accentColor}
                  onChange={setAccentColor}
                />
                <ChoiceRow
                  label="Background"
                  value={design.backgroundStyle}
                  options={[
                    ["light", "Light"],
                    ["dark", "Dark"],
                    ["gradient", "Gradient"],
                  ]}
                  onChange={(value) =>
                    updateDesign(
                      "backgroundStyle",
                      value as StorefrontDesign["backgroundStyle"],
                    )
                  }
                />
              </Panel>
            </>
          )}

          {activeTab === "contact" && (
            <>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-700 bg-slate-950/30 p-1 light:border-slate-200 light:bg-slate-100">
                {(
                  [
                    ["content", "Page content"],
                    ["details", "Contact details"],
                    ["social", "Social links"],
                  ] as const
                ).map(([section, label]) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setContactSection(section)}
                    className={cn(
                      "rounded-lg px-2 py-2 text-[10px] font-black transition",
                      contactSection === section
                        ? "bg-violet-600 text-white shadow"
                        : "text-slate-400 hover:text-white light:text-slate-600 light:hover:text-slate-950",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {contactSection === "content" && (
                <Panel
                  title="Contact page content"
                  hint="Edit the headline and reassurance customers see at the top."
                >
                  <Input
                    label="Small heading"
                    value={design.contactEyebrow}
                    maxLength={50}
                    onChange={(event) =>
                      updateDesign("contactEyebrow", event.target.value)
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Main heading"
                      value={design.contactHeading}
                      maxLength={80}
                      onChange={(event) =>
                        updateDesign("contactHeading", event.target.value)
                      }
                    />
                    <Input
                      label="Highlighted heading"
                      value={design.contactAccent}
                      maxLength={80}
                      onChange={(event) =>
                        updateDesign("contactAccent", event.target.value)
                      }
                    />
                  </div>
                  <Textarea
                    label="Introduction"
                    value={design.contactDescription}
                    maxLength={240}
                    rows={3}
                    onChange={(event) =>
                      updateDesign("contactDescription", event.target.value)
                    }
                  />
                  <Input
                    label="Quick response text"
                    value={design.contactResponseText}
                    maxLength={80}
                    onChange={(event) =>
                      updateDesign("contactResponseText", event.target.value)
                    }
                  />
                  <Input
                    label="Customer support text"
                    value={design.contactSupportText}
                    maxLength={80}
                    placeholder="Uses your business hours when blank"
                    onChange={(event) =>
                      updateDesign("contactSupportText", event.target.value)
                    }
                  />
                  <Input
                    label="Trusted service text"
                    value={design.contactTrustText}
                    maxLength={80}
                    onChange={(event) =>
                      updateDesign("contactTrustText", event.target.value)
                    }
                  />
                </Panel>
              )}
              {contactSection === "details" && (
                <Panel
                  title="Contact information"
                  hint="Customers use these details to call, email, or find you."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Phone"
                      value={contactDetails.phone}
                      onChange={(event) =>
                        setContactDetails((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={contactDetails.email}
                      onChange={(event) =>
                        setContactDetails((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Street address"
                      value={contactDetails.address}
                      onChange={(event) =>
                        setContactDetails((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="City"
                      value={contactDetails.city}
                      onChange={(event) =>
                        setContactDetails((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Maps share URL"
                        type="url"
                        value={design.contactMapUrl}
                        placeholder="Paste the link from Google Maps → Share"
                        maxLength={500}
                        onChange={(event) =>
                          updateDesign("contactMapUrl", event.target.value)
                        }
                      />
                      <p className="mt-1.5 text-[10px] leading-4 text-slate-500 light:text-slate-600">
                        Open your location in Maps, choose Share, copy the link,
                        and paste it here. Customers will use it for directions.
                      </p>
                    </div>
                  </div>
                </Panel>
              )}
              {contactSection === "social" && (
                <Panel
                  title="Website and social links"
                  hint="Add each profile, then choose which icons customers can see."
                >
                  <Input
                    label="Website"
                    value={socialLinks.website ?? ""}
                    placeholder="https://example.com"
                    onChange={(event) =>
                      setSocialLinks((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                  />
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Social icons
                    </span>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() =>
                          updateDesign("visibleSocials", [
                            ...STOREFRONT_SOCIAL_PLATFORMS,
                          ])
                        }
                        className="text-violet-300 hover:text-violet-200 light:text-violet-700"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDesign("visibleSocials", [])}
                        className="text-slate-400 hover:text-slate-200 light:text-slate-600"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SOCIAL_EDITOR_PLATFORMS.map((platform) => {
                      const visible = design.visibleSocials.includes(
                        platform.key,
                      );
                      return (
                        <div
                          key={platform.key}
                          className="space-y-2 rounded-lg border border-slate-700 p-2 light:border-slate-200"
                        >
                          <Toggle
                            label={platform.label}
                            checked={visible}
                            onChange={(checked) =>
                              updateDesign(
                                "visibleSocials",
                                checked
                                  ? Array.from(
                                      new Set([
                                        ...design.visibleSocials,
                                        platform.key,
                                      ]),
                                    )
                                  : design.visibleSocials.filter(
                                      (item) => item !== platform.key,
                                    ),
                              )
                            }
                          />
                          <Input
                            aria-label={`${platform.label} profile`}
                            value={socialLinks[platform.key] ?? ""}
                            placeholder={platform.placeholder}
                            className="py-2 text-xs"
                            onChange={(event) =>
                              setSocialLinks((current) => ({
                                ...current,
                                [platform.key]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )}
            </>
          )}

          {activeTab === "seo" && (
            <Panel
              title="Storefront URL"
              hint="Choose the public address customers will use."
            >
              <Input
                label="URL name"
                value={slug}
                disabled={!tenant.storefrontUrlEditAllowed}
                onChange={(event) => setSlug(event.target.value)}
                className={cn(
                  !tenant.storefrontUrlEditAllowed &&
                    "cursor-not-allowed opacity-60",
                )}
              />
              {!tenant.storefrontUrlEditAllowed && (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[10px] leading-4 text-amber-200 light:text-amber-800">
                  Your storefront URL was reserved when the business was
                  created. Contact YuhBusiness support if you need permission to
                  change it.
                </p>
              )}
              <div className="break-all rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-xs font-semibold text-violet-300">
                {(
                  process.env.NEXT_PUBLIC_APP_URL || "https://yuhbusiness.com"
                ).replace(/\/$/, "")}
                /store-front/{slug || "your-store"}
              </div>
              <p className="text-xs text-slate-400">
                Custom address: {slug || "your-store"}.yuhbusiness.com
              </p>
            </Panel>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {success}
            </p>
          )}
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/30 p-2 light:border-slate-200 light:bg-slate-50">
            <span className="px-2 text-xs font-black text-white light:text-slate-900">
              Live Preview
            </span>
            <div className="flex gap-1">
              <PreviewButton
                active={previewMode === "desktop"}
                onClick={() => setPreviewMode("desktop")}
                icon={Monitor}
              >
                Desktop
              </PreviewButton>
              <PreviewButton
                active={previewMode === "mobile"}
                onClick={() => setPreviewMode("mobile")}
                icon={Smartphone}
              >
                Mobile
              </PreviewButton>
            </div>
          </div>
          <div
            className={cn(
              "flex min-h-130 items-start justify-center rounded-2xl border p-3 transition-colors",
              theme === "light"
                ? "border-slate-200 bg-slate-100"
                : "border-slate-700 bg-[#050a12]",
            )}
          >
            {activeTab === "contact" ? (
              <ContactPagePreview
                tenant={previewTenant}
                mobile={previewMode === "mobile"}
                theme={theme}
              />
            ) : (
              <StorefrontPreview
                tenant={previewTenant}
                mobile={previewMode === "mobile"}
                theme={theme}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StorefrontPreview({
  tenant,
  mobile,
  theme,
}: {
  tenant: Tenant;
  mobile: boolean;
  theme: PreviewTheme;
}) {
  const design = parseStorefrontDesign(
    tenant.storefrontDesign,
    tenant.businessType,
  );
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-2xl transition-all",
        theme === "light"
          ? "border-slate-200 bg-white"
          : "border-slate-700 bg-[#07111f]",
        mobile ? "w-70" : "w-full",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2",
          theme === "light"
            ? "border-slate-200 bg-white"
            : "border-slate-700 bg-[#07111f]",
        )}
      >
        <BusinessLogo
          tenant={tenant}
          className="h-7 w-7 rounded-md text-[10px] font-black"
        />
        <strong
          className={cn(
            "truncate text-[10px]",
            theme === "light" ? "text-slate-950" : "text-white",
          )}
        >
          {tenant.name}
        </strong>
        <div
          className={cn(
            "ml-auto flex items-center gap-3 text-[8px] font-bold",
            theme === "light" ? "text-slate-600" : "text-slate-300",
          )}
        >
          {!mobile && (
            <>
              <span>Home</span>
              <span>
                {tenant.businessType === "appointment" ? "Services" : "Shop"}
              </span>
              {design.sections.about && <span>About</span>}
              {design.sections.contact && <span>Contact</span>}
            </>
          )}
          {mobile && <span>☰</span>}
        </div>
      </div>
      <StorefrontHero tenant={tenant} compact />
      <div
        className={cn(
          "space-y-4 p-3 transition-colors",
          theme === "light" ? "bg-slate-50" : "bg-[#07111f]",
        )}
      >
        {design.sections.categories && (
          <PreviewCards
            title="Shop by Category"
            count={mobile ? 2 : 4}
            theme={theme}
          />
        )}
        {design.sections.featured && (
          <PreviewCards
            title={
              tenant.businessType === "appointment"
                ? "Popular Services"
                : "Featured Products"
            }
            count={mobile ? 1 : 4}
            theme={theme}
          />
        )}
        {design.sections.promotions && (
          <div
            className="rounded-lg p-4 text-sm font-black text-white"
            style={{
              background: `linear-gradient(120deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
            }}
          >
            Special offers for your customers
          </div>
        )}
      </div>
    </div>
  );
}

function ContactPagePreview({
  tenant,
  mobile,
  theme,
}: {
  tenant: Tenant;
  mobile: boolean;
  theme: PreviewTheme;
}) {
  const design = parseStorefrontDesign(
    tenant.storefrontDesign,
    tenant.businessType,
  );
  const location = [tenant.address, tenant.city].filter(Boolean).join(", ");
  const details = [
    { label: "Phone", value: tenant.phone, icon: Phone },
    { label: "Email", value: tenant.email, icon: Mail },
    { label: "Location", value: location, icon: MapPin },
  ].filter((item) => item.value);
  const selectedSocials = design.visibleSocials.filter(
    (platform) => tenant.socialLinks[platform],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-2xl transition-all",
        theme === "light"
          ? "border-slate-200 bg-slate-100"
          : "border-slate-700 bg-[#07111f]",
        mobile ? "w-70" : "w-full",
      )}
    >
      <div
        className={cn(
          "grid overflow-hidden transition-colors",
          theme === "light" ? "bg-white" : "bg-[#0b1525]",
          mobile ? "grid-cols-1" : "grid-cols-[1.08fr_0.92fr]",
        )}
      >
        <div className="p-4">
          <p
            className="text-[7px] font-black uppercase tracking-[0.18em]"
            style={{ color: tenant.primaryColor }}
          >
            {design.contactEyebrow}
          </p>
          <h4
            className={cn(
              "mt-2 text-xl font-black leading-tight",
              theme === "light" ? "text-slate-950" : "text-white",
            )}
          >
            {design.contactHeading}{" "}
            <span style={{ color: tenant.accentColor }}>
              {design.contactAccent}
            </span>
          </h4>
          <p
            className={cn(
              "mt-2 line-clamp-3 text-[8px] leading-4",
              theme === "light" ? "text-slate-500" : "text-slate-300",
            )}
          >
            {design.contactDescription}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              ["Quick Response", design.contactResponseText],
              ["Support", design.contactSupportText || "Business hours"],
              ["Trusted", design.contactTrustText],
            ].map(([title, text]) => (
              <div key={title} className="min-w-0">
                <span
                  className="mb-1 block h-4 w-4 rounded-full"
                  style={{ backgroundColor: tenant.primaryColor }}
                />
                <strong
                  className={cn(
                    "block truncate text-[6px]",
                    theme === "light" ? "text-slate-900" : "text-white",
                  )}
                >
                  {title}
                </strong>
                <span
                  className={cn(
                    "mt-0.5 line-clamp-2 block text-[6px] leading-3",
                    theme === "light" ? "text-slate-500" : "text-slate-400",
                  )}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div
          className={cn("min-h-40 bg-slate-900", mobile && "hidden")}
          style={
            tenant.coverImage
              ? {
                  backgroundImage: `linear-gradient(0deg, rgba(15, 23, 42, 0.25), transparent), url(${tenant.coverImage})`,
                  backgroundPosition: `${tenant.coverImagePositionX ?? 50}% ${tenant.coverImagePositionY ?? 50}%`,
                  backgroundSize: `${tenant.coverImageZoom ?? 100}%`,
                  backgroundRepeat: "no-repeat",
                }
              : {
                  background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
                }
          }
        />
      </div>

      <div
        className={cn(
          "grid gap-2 p-3 transition-colors",
          theme === "light" ? "bg-slate-100" : "bg-[#07111f]",
          mobile ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        <div
          className={cn(
            "rounded-lg border p-3",
            theme === "light"
              ? "border-transparent bg-white"
              : "border-slate-700 bg-slate-900",
          )}
        >
          <strong
            className={cn(
              "text-[9px]",
              theme === "light" ? "text-slate-950" : "text-white",
            )}
          >
            Send us a message
          </strong>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {["name", "email", "subject", "message"].map((field) => (
              <span
                key={field}
                className={cn(
                  "rounded border",
                  field === "subject" || field === "message"
                    ? "col-span-2"
                    : "",
                  field === "message" ? "h-14" : "h-6",
                  theme === "light"
                    ? "border-slate-200 bg-white"
                    : "border-slate-700 bg-slate-800",
                )}
              />
            ))}
          </div>
          <span
            className="mt-2 block h-6 rounded"
            style={{ backgroundColor: tenant.primaryColor }}
          />
        </div>
        <div
          className={cn(
            "rounded-lg border p-3",
            theme === "light"
              ? "border-transparent bg-white"
              : "border-slate-700 bg-slate-900",
          )}
        >
          <strong
            className={cn(
              "text-[9px]",
              theme === "light" ? "text-slate-950" : "text-white",
            )}
          >
            Contact information
          </strong>
          <div className="mt-2 space-y-1.5">
            {details.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded border p-1.5",
                  theme === "light"
                    ? "border-slate-200"
                    : "border-slate-700 bg-slate-800",
                )}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <span className="min-w-0">
                  <strong
                    className={cn(
                      "block text-[6px]",
                      theme === "light" ? "text-slate-900" : "text-white",
                    )}
                  >
                    {label}
                  </strong>
                  <span
                    className={cn(
                      "block truncate text-[6px]",
                      theme === "light" ? "text-slate-500" : "text-slate-400",
                    )}
                  >
                    {value}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {selectedSocials.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedSocials.map((platform) => (
                <span
                  key={platform}
                  className="rounded bg-violet-100 px-1.5 py-1 text-[6px] font-bold capitalize text-violet-700"
                >
                  {platform === "twitter" ? "X" : platform}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewCards({
  title,
  count,
  theme,
}: {
  title: string;
  count: number;
  theme: PreviewTheme;
}) {
  return (
    <div>
      <div
        className={cn(
          "mb-2 flex justify-between text-[10px] font-black",
          theme === "light" ? "text-slate-900" : "text-white",
        )}
      >
        <span>{title}</span>
        <span
          className={cn(
            theme === "light" ? "text-violet-700" : "text-violet-300",
          )}
        >
          View all →
        </span>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className={cn(
              "h-20 rounded-lg border bg-linear-to-br",
              theme === "light"
                ? "border-slate-200 from-white to-slate-200"
                : "border-slate-700 from-slate-700 to-slate-900",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/20 p-4 light:border-slate-200 light:bg-slate-50">
      <div>
        <h4 className="text-xs font-black text-white light:text-slate-900">
          {title}
        </h4>
        {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ImagePicker({
  id,
  src,
  label,
  onSelect,
}: {
  id: string;
  src: string;
  label: string;
  onSelect: (file: File) => void;
}) {
  return (
    <div className="relative h-40 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Hero preview"
            className="h-full w-full object-cover"
          />
        </>
      ) : (
        <ImageIcon className="absolute inset-0 m-auto h-8 w-8 text-slate-500" />
      )}
      <div className="absolute inset-x-2 bottom-2">
        <ImageUploadButton id={id} label={label} onSelect={onSelect} />
      </div>
    </div>
  );
}

function ImageUploadButton({
  id,
  label,
  onSelect,
}: {
  id: string;
  label: string;
  onSelect: (file: File) => void;
}) {
  return (
    <>
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-950/80 px-3 py-2 text-[10px] font-black text-white backdrop-blur hover:bg-violet-600"
      >
        <Upload className="h-3.5 w-3.5" />
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
        }}
      />
    </>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold text-slate-300 light:text-slate-700">
        {label}
      </p>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg border px-2 py-2 text-[10px] font-bold",
              value === option
                ? "border-violet-400 bg-violet-500/20 text-violet-200 light:text-violet-700"
                : "border-slate-700 text-slate-400 light:border-slate-300",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] font-bold text-slate-200 light:border-slate-300 light:text-slate-700"
    >
      <span>{label}</span>
      <span
        className={cn(
          "flex h-5 w-9 items-center rounded-full p-0.5 transition",
          checked ? "bg-violet-600" : "bg-slate-600",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full bg-white transition",
            checked && "translate-x-4",
          )}
        >
          {checked && <Check className="h-2.5 w-2.5 text-violet-700" />}
        </span>
      </span>
    </button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  suffix = "%",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[10px] font-bold text-slate-300 light:text-slate-700">
      <span className="flex justify-between">
        <span>{label}</span>
        <span>
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-violet-500"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[10px] font-bold text-slate-300 light:text-slate-700">
      {label}
      <span className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 rounded-lg border border-slate-600 bg-transparent p-1"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white light:bg-white light:text-slate-900"
        />
      </span>
    </label>
  );
}

function PreviewButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Monitor;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold",
        active ? "bg-violet-600 text-white" : "text-slate-400",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
