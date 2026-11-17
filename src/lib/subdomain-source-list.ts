// Shared (browser-safe) list of sources and the domain format check.
export const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export const SOURCE_IDS = [
  "crt.sh",
  "crt.name",
  "agniops",
  "certspotter",
  "hackertarget",
  "rapiddns",
  "urlscan",
  "subdomainfinder.in",
  "anubis",
  "alienvault-otx",
  "osint.sh",
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
