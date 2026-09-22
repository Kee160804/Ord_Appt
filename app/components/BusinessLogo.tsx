import type { Tenant } from "@/app/types";

export function BusinessLogo({
  tenant,
  className = "",
}: {
  tenant: Pick<Tenant, "logo" | "logoBg" | "logoImage" | "name">;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden text-white ${className}`}
      style={{ backgroundColor: tenant.logoBg }}
      aria-label={`${tenant.name} logo`}
    >
      {tenant.logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenant.logoImage}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        tenant.logo
      )}
    </span>
  );
}
