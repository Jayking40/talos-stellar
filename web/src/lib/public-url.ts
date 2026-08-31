import { NextRequest } from "next/server";

export function getPublicBaseUrl(reqOrHeaders: Request | NextRequest | Headers): string {
  const headers = reqOrHeaders instanceof Headers 
    ? reqOrHeaders 
    : ('headers' in reqOrHeaders ? reqOrHeaders.headers : new Headers());

  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  
  const forwardedHost = headers.get("x-forwarded-host");
  const hostHeader = headers.get("host");
  const forwardedProto = headers.get("x-forwarded-proto");

  // Reject comma-separated ambiguous values
  if (forwardedHost && forwardedHost.includes(",")) throw new Error("Ambiguous X-Forwarded-Host");
  if (hostHeader && hostHeader.includes(",")) throw new Error("Ambiguous Host");
  if (forwardedProto && forwardedProto.includes(",")) throw new Error("Ambiguous X-Forwarded-Proto");

  // If x-forwarded-host and host both exist and we want to prevent conflicts? 
  // Normally proxy modifies host, or keeps original in x-forwarded-host. 
  // We'll trust x-forwarded-host if present, else host.
  const host = forwardedHost || hostHeader;

  if (!host) {
    if (configuredUrl) return configuredUrl.replace(/\/$/, "");
    return "http://localhost:3000";
  }

  // Basic malformed host check (e.g. injects paths)
  if (host.includes("/") || host.includes("\\")) {
    throw new Error("Malformed host header");
  }

  const protocol = forwardedProto === "http" ? "http" : "https";
  let hostname = host;
  if (host.includes(":")) {
    // IPv6 support needs bracket handling, but for now simple split or URL parser
    try {
      const parsed = new URL(`http://${host}`);
      hostname = parsed.hostname;
    } catch {
      throw new Error("Malformed host header");
    }
  }

  const trustedHosts = (process.env.TRUSTED_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  if (configuredUrl) {
    try {
      trustedHosts.push(new URL(configuredUrl).hostname);
    } catch (e) {}
  }

  const isLocal = process.env.NODE_ENV !== "production";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".local");

  const isTrusted = trustedHosts.includes(hostname) || (isLocal && isLocalHost);

  if (!isTrusted) {
    if (configuredUrl) {
      return configuredUrl.replace(/\/$/, "");
    }
    throw new Error("Untrusted host header");
  }

  const finalProtocol = (isLocal && isLocalHost && !forwardedProto) ? "http" : protocol;
  return `${finalProtocol}://${host}`;
}
