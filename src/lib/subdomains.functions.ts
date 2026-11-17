import { createServerFn } from "@tanstack/react-start";
import {
  DOMAIN_RE,
  SOURCE_IDS,
  cleanNames,
  isLive,
  runSource,
  type SourceId,
} from "./subdomain-sources.server";

function normalizeDomain(input: string): string {
  const d = (
    String(input ?? "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0] ?? ""
  ).replace(/^\*\./, "");
  if (!DOMAIN_RE.test(d)) throw new Error("Enter a valid domain such as example.com");
  return d;
}

export const querySource = createServerFn({ method: "POST" })
  .inputValidator((data: { domain: string; source: string }) => {
    const domain = normalizeDomain(data.domain);
    if (!(SOURCE_IDS as readonly string[]).includes(data.source)) throw new Error("Unknown source");
    return { domain, source: data.source as SourceId };
  })
  .handler(async ({ data }) => {
    try {
      const names = await runSource(data.source, data.domain);
      return { ok: true as const, names, error: null };
    } catch (e) {
      console.error(`source ${data.source} failed`, e);
      const msg = e instanceof Error ? e.message : "failed";
      return { ok: false as const, names: [] as string[], error: msg.slice(0, 80) };
    }
  });

export const checkLive = createServerFn({ method: "POST" })
  .inputValidator((data: { domain: string; hosts: string[] }) => {
    const domain = normalizeDomain(data.domain);
    const hosts = cleanNames((data.hosts ?? []).slice(0, 40), domain);
    return { domain, hosts };
  })
  .handler(async ({ data }) => {
    const results = await Promise.all(data.hosts.map(async (h) => [h, await isLive(h)] as const));
    return { live: results.filter(([, ok]) => ok).map(([h]) => h), checked: data.hosts };
  });
