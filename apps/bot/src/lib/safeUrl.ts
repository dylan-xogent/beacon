import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Returns true for loopback, private, link-local, and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const v = address.toLowerCase().replace(/^\[|\]$/g, "");

  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  if (isIP(v) === 6) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return /^(fc|fd|fe[89ab])/.test(v);
  }

  return false;
}

/**
 * Throws unless `rawUrl` is an http(s) URL whose host resolves only to public
 * addresses. Prevents users from pointing feed polling at internal services.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Feed URL must use http or https");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Feed URL must point to a public host");
  }

  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Feed URL must point to a public host");
  }
}
