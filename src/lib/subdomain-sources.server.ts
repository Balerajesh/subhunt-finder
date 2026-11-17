// Server-only helpers: query public subdomain sources. Runs on the edge runtime (fetch only).
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

import { DOMAIN_RE, SOURCE_IDS, type SourceId } from "./subdomain-source-list";
export { DOMAIN_RE, SOURCE_IDS, type SourceId };

async function get(url: string, init: RequestInit = {}, timeoutMs = 25000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*", ...(init.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extract(text: string, d: string): string[] {
  const re = new RegExp(
    "(?:[a-z0-9_*](?:[a-z0-9_\\-*]{0,61}[a-z0-9_*])?\\.)+" + escapeRe(d),
    "gi",
  );
  return text.match(re) ?? [];
}

export function cleanNames(names: string[], d: string): string[] {
  const out = new Set<string>();
  for (const raw of names) {
    let n = String(raw).trim().toLowerCase().replace(/\.$/, "");
    n = n.replace(/^\*\./, "");
    n = (n.replace(/^https?:\/\//, "").split("/")[0] ?? "").split(":")[0] ?? "";
    if (!n || n.includes("*") || n.includes(" ")) continue;
    if (n !== d && !n.endsWith("." + d)) continue;
    if (!/^[a-z0-9_.-]+$/.test(n) || n.includes("..")) continue;
    out.add(n);
  }
  return [...out].sort();
}

const fetchers: Record<SourceId, (d: string) => Promise<string[]>> = {
  "crt.sh": async (d) => {
    const rows = JSON.parse(await get(`https://crt.sh/?q=%25.${d}&output=json`, {}, 50000));
    return rows.flatMap((r: { name_value?: string }) => (r.name_value ?? "").split("\n"));
  },
  "crt.name": async (d) => extract(await get(`https://crt.name/v1/search?apex=${d}`), d),
  agniops: async (d) => extract(await get(`https://app.agniops.in/v1/search?domain=${d}`), d),
  certspotter: async (d) => {
    const rows = JSON.parse(
      await get(
        `https://api.certspotter.com/v1/issuances?domain=${d}&include_subdomains=true&expand=dns_names`,
      ),
    );
    return rows.flatMap((r: { dns_names?: string[] }) => r.dns_names ?? []);
  },
  hackertarget: async (d) => {
    const t = await get(`https://api.hackertarget.com/hostsearch/?q=${d}`);
    if (t.includes("API count exceeded")) throw new Error("rate limited");
    return t
      .split("\n")
      .filter((l) => l.includes(","))
      .map((l) => l.split(",")[0] ?? "");
  },
  rapiddns: async (d) => extract(await get(`https://rapiddns.io/subdomain/${d}?full=1`), d),
  urlscan: async (d) => {
    const j = JSON.parse(await get(`https://urlscan.io/api/v1/search/?q=domain:${d}&size=1000`));
    return (j.results ?? []).flatMap((r: { task?: { domain?: string }; page?: { domain?: string } }) => [
      r.task?.domain ?? "",
      r.page?.domain ?? "",
    ]);
  },
  "subdomainfinder.in": async (d) => {
    const j = JSON.parse(
      await get(`https://api.subdomainfinder.in/?domain=${d}`, {
        headers: {
          "X-Referer": "https://subdomainfinder.in/",
          Origin: "https://subdomainfinder.in",
          Referer: "https://subdomainfinder.in/",
        },
      }),
    );
    return (j.data ?? []).map((r: { subdomain: string }) => r.subdomain);
  },
  anubis: async (d) => JSON.parse(await get(`https://jonlu.ca/anubis/subdomains/${d}`)),
  "alienvault-otx": async (d) => {
    const j = JSON.parse(
      await get(`https://otx.alienvault.com/api/v1/indicators/domain/${d}/passive_dns`),
    );
    return (j.passive_dns ?? []).map((r: { hostname?: string }) => r.hostname ?? "");
  },
  "osint.sh": async (d) =>
    extract(
      await get("https://osint.sh/subdomain/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ domain: d }).toString(),
      }),
      d,
    ),
};

export async function runSource(source: SourceId, domain: string): Promise<string[]> {
  return cleanNames(await fetchers[source](domain), domain);
}

// DNS-over-HTTPS check (the edge runtime has no raw DNS access).
export async function isLive(host: string): Promise<boolean> {
  try {
    const t = await get(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { Accept: "application/dns-json" } },
      8000,
    );
    const j = JSON.parse(t);
    return j.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0;
  } catch {
    return false;
  }
}
