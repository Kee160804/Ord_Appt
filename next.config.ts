import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the directory containing this configuration file.
 *
 * Turbopack uses this as the explicit project root so Next.js does not
 * accidentally select a parent directory when multiple package/lock files
 * exist elsewhere on the development machine.
 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Detect the current runtime environment.
 *
 * React/Turbopack requires eval() for some development-only debugging
 * functionality. We therefore allow `unsafe-eval` ONLY while running the
 * application in development.
 *
 * Production remains protected and does not receive `unsafe-eval`.
 */
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * --------------------------------------------------------------------------
 * Content Security Policy
 * --------------------------------------------------------------------------
 *
 * CSP reduces the impact of attacks such as cross-site scripting (XSS) by
 * restricting where scripts, styles, images, API requests, fonts, frames,
 * workers, and other browser resources may originate.
 *
 * This policy is kept compatible with the current YuhBusiness stack:
 *
 * - Next.js / React
 * - Turbopack development
 * - Supabase REST/Auth/Storage
 * - Supabase Realtime
 * - Vercel
 * - Externally hosted HTTPS business/product images
 * - PWA / service worker
 *
 * NOTE:
 * `unsafe-inline` is currently retained for scripts/styles because Next.js
 * may rely on inline framework/bootstrap content. Moving to a nonce-based CSP
 * can be handled later as a separate security-hardening task.
 */
const contentSecurityPolicy = [
  /**
   * By default, resources may only originate from YuhBusiness itself.
   */
  "default-src 'self'",

  /**
   * Next.js may generate inline framework/bootstrap scripts.
   *
   * DEVELOPMENT:
   * React/Turbopack uses eval() for debugging functionality such as
   * reconstructing development call stacks.
   *
   * PRODUCTION:
   * `unsafe-eval` is deliberately omitted.
   */
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,

  /**
   * Tailwind/Next.js may rely on inline styles.
   */
  "style-src 'self' 'unsafe-inline'",

  /**
   * Allow:
   * - local application images
   * - HTTPS-hosted tenant/product images
   * - data URLs
   * - blob URLs
   */
  "img-src 'self' https: data: blob:",

  /**
   * Fonts should normally come from the application itself.
   *
   * data: is retained for generated/embedded font resources.
   */
  "font-src 'self' data:",

  /**
   * Browser network connections.
   *
   * Supabase uses:
   * - HTTPS for REST/Auth/Storage
   * - WSS for Realtime
   *
   * Resend is intentionally NOT included because YuhBusiness communicates
   * with Resend from server-side routes rather than directly from browsers.
   */
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",

  /**
   * Prevent legacy embedded browser plugins.
   */
  "object-src 'none'",

  /**
   * Prevent malicious <base> tags from rewriting relative application URLs.
   */
  "base-uri 'self'",

  /**
   * HTML forms may only submit back to YuhBusiness.
   */
  "form-action 'self'",

  /**
   * Prevent YuhBusiness from being embedded inside arbitrary third-party
   * frames. This protects against clickjacking.
   */
  "frame-ancestors 'none'",

  /**
   * Third-party frames are currently blocked.
   *
   * If DigiWallet later requires an embedded payment frame, add ONLY the
   * officially documented DigiWallet frame origin after reviewing its API
   * documentation.
   */
  "frame-src 'self'",

  /**
   * Restrict web workers/service workers to the application.
   *
   * blob: is retained for framework/browser worker compatibility.
   */
  "worker-src 'self' blob:",

  /**
   * Restrict PWA manifests to this application.
   */
  "manifest-src 'self'",

  /**
   * Media may originate locally or from HTTPS sources.
   */
  "media-src 'self' https:",

  /**
   * Production should automatically upgrade insecure HTTP subresources to
   * HTTPS.
   *
   * This is deliberately disabled during local development because forcing
   * HTTPS upgrades can interfere with localhost development resources.
   */
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * --------------------------------------------------------------------------
 * Global Security Headers
 * --------------------------------------------------------------------------
 *
 * These headers are applied throughout the application.
 *
 * The service worker receives additional caching headers further below.
 */
const securityHeaders = [
  {
    /**
     * Main Content Security Policy.
     */
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    /**
     * Defense-in-depth clickjacking protection.
     *
     * CSP frame-ancestors is the modern protection, but X-Frame-Options
     * provides additional protection for older browsers.
     */
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    /**
     * Prevent browsers from MIME-sniffing a response into a different content
     * type.
     */
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    /**
     * Limit how much referrer information is disclosed when navigating away
     * from YuhBusiness.
     */
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    /**
     * Disable browser capabilities YuhBusiness does not currently require.
     *
     * If a future feature genuinely requires one of these capabilities,
     * explicitly enable only the required capability.
     *
     * NOTE:
     * payment=() is acceptable while real payment-provider integration is
     * deferred. Revisit this when DigiWallet integration begins if its
     * documented browser flow requires the Payment Request API.
     */
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    /**
     * Prevent automatic DNS prefetching unless the application deliberately
     * enables it later.
     */
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
];

/**
 * --------------------------------------------------------------------------
 * Main Next.js Configuration
 * --------------------------------------------------------------------------
 */
const nextConfig: NextConfig = {
  /**
   * Keep the project's existing Agent Rules configuration unchanged.
   */
  agentRules: false,

  /**
   * Explicit Turbopack project root.
   *
   * This avoids Next.js/Turbopack accidentally selecting a parent directory
   * containing another lock file as the project root.
   */
  turbopack: {
    root: projectRoot,
  },

  /**
   * Abort superseded React Server Component refreshes cleanly during HMR.
   * Without this, Next 16.3 can report an expected browser cancellation as
   * "The destination stream closed early" and race an App Router refresh.
   */
  experimental: {
    serverComponentsHmrCancellation: true,
  },

  /**
   * ------------------------------------------------------------------------
   * Next.js Image Optimization
   * ------------------------------------------------------------------------
   *
   * These are the explicitly trusted remote hosts that Next.js Image
   * Optimization may retrieve images from.
   *
   * Keep this list narrow.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/**",
      },
    ],
  },

  /**
   * ------------------------------------------------------------------------
   * HTTP Response Headers
   * ------------------------------------------------------------------------
   */
  async headers() {
    return [
      /**
       * --------------------------------------------------------------
       * GLOBAL SECURITY HEADERS
       * --------------------------------------------------------------
       *
       * Apply the security policy throughout YuhBusiness.
       */
      {
        source: "/(.*)",
        headers: securityHeaders,
      },

      /**
       * --------------------------------------------------------------
       * SERVICE WORKER
       * --------------------------------------------------------------
       *
       * Keep the existing service-worker behavior.
       *
       * Service workers should not be aggressively cached because an old
       * worker can continue controlling clients after a new deployment.
       */
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
