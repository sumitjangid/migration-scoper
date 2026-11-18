import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolvedAddress = { address: string; family: number };

export class UnsafeTargetUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTargetUrlError";
  }
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second, third] = octets;
  if (first === undefined || second === undefined || third === undefined) return false;
  return !(
    first === 0
    || first === 10
    || (first === 100 && second >= 64 && second <= 127)
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 88 && third === 99)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
  );
}

function parseIpv6(address: string): number[] | null {
  let value = address.toLowerCase();
  const ipv4Separator = value.lastIndexOf(":");
  if (value.includes(".") && ipv4Separator >= 0) {
    const ipv4 = value.slice(ipv4Separator + 1).split(".").map(Number);
    if (ipv4.length !== 4 || ipv4.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    const [a, b, c, d] = ipv4;
    if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
    value = `${value.slice(0, ipv4Separator)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = [...left, ...right];
  if (groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) return null;
  const missing = 8 - groups.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const expanded = [...left, ...Array(missing).fill("0"), ...right].map((group) => Number.parseInt(group, 16));
  return expanded.flatMap((group) => [group >> 8, group & 0xff]);
}

function isPublicIpv6(address: string): boolean {
  const bytes = parseIpv6(address);
  if (!bytes) return false;

  const isIpv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0)
    && bytes[10] === 255 && bytes[11] === 255;
  if (isIpv4Mapped) {
    return isPublicIpv4(bytes.slice(12).join("."));
  }

  const isGlobalUnicast = bytes[0] !== undefined && (bytes[0] & 0xe0) === 0x20;
  const isTeredoOrSpecial = bytes[0] === 0x20 && bytes[1] === 0x01
    && bytes[2] === 0x00 && (bytes[3] ?? 0) < 0x80;
  const isDocumentation = bytes[0] === 0x20 && bytes[1] === 0x01
    && bytes[2] === 0x0d && bytes[3] === 0xb8;
  const isSixToFour = bytes[0] === 0x20 && bytes[1] === 0x02;
  const isIpv6Documentation = bytes[0] === 0x3f && bytes[1] === 0xff
    && bytes[2] !== undefined && (bytes[2] & 0xf0) === 0;
  return isGlobalUnicast && !isTeredoOrSpecial && !isDocumentation && !isSixToFour && !isIpv6Documentation;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export async function assertPublicHttpUrl(
  target: string,
  resolveAddresses: (hostname: string) => Promise<ResolvedAddress[]> = (hostname) =>
    lookup(hostname, { all: true, verbatim: true }),
): Promise<{
  url: URL;
  addresses: ResolvedAddress[];
}> {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new UnsafeTargetUrlError("Enter a valid public HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UnsafeTargetUrlError("Only HTTP(S) storefront URLs are supported.");
  }
  if (url.username || url.password) {
    throw new UnsafeTargetUrlError("URLs containing usernames or passwords are not supported.");
  }
  const standardPort = url.protocol === "http:" ? "80" : "443";
  if (url.port && url.port !== standardPort) {
    throw new UnsafeTargetUrlError("Only standard HTTP and HTTPS ports are supported.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  const family = isIP(hostname);
  if (!family && (
    !hostname.includes(".")
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".test")
    || hostname.endsWith(".invalid")
    || hostname.endsWith(".example")
    || hostname.endsWith(".home.arpa")
  )) {
    throw new UnsafeTargetUrlError("Local and intranet hostnames cannot be crawled.");
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = family
      ? [{ address: hostname, family }]
      : await resolveAddresses(hostname);
  } catch {
    throw new UnsafeTargetUrlError("The storefront hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new UnsafeTargetUrlError("The storefront must resolve only to public IP addresses.");
  }

  return { url, addresses };
}
