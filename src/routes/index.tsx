import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkLive, querySource } from "@/lib/subdomains.functions";
import { DOMAIN_RE, SOURCE_IDS, type SourceId } from "@/lib/subdomain-source-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SubHunt — Combined Subdomain Finder" },
      {
        name: "description",
        content:
          "Enter a domain and SubHunt queries crt.sh, crt.name, CertSpotter, RapidDNS and more, then gives you one merged, unique subdomain list.",
      },
      { property: "og:title", content: "SubHunt — Combined Subdomain Finder" },
      {
        property: "og:description",
        content: "One domain in, one merged and de-duplicated subdomain list out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Status = { state: "idle" | "running" | "done" | "failed"; names: string[]; error?: string };

const allStatuses = (state: Status["state"]) => {
  const out = {} as Record<SourceId, Status>;
  for (const s of SOURCE_IDS) out[s] = { state, names: [] };
  return out;
};
const emptyStatuses = () => allStatuses("idle");

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Index() {
  const runSource = useServerFn(querySource);
  const runLive = useServerFn(checkLive);

  const [input, setInput] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [statuses, setStatuses] = useState<Record<SourceId, Status>>(emptyStatuses);
  const [open, setOpen] = useState<SourceId | null>(null);
  const [live, setLive] = useState<string[] | null>(null);
  const [liveBusy, setLiveBusy] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const running = SOURCE_IDS.some((s) => statuses[s].state === "running");

  const merged = useMemo(() => {
    const set = new Set<string>();
    SOURCE_IDS.forEach((s) => statuses[s].names.forEach((n) => set.add(n)));
    return [...set].sort();
  }, [statuses]);

  const totalRaw = SOURCE_IDS.reduce((a, s) => a + statuses[s].names.length, 0);
  const shown = live ?? merged;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const d = (
      input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0] ?? ""
    ).replace(/^\*\./, "");
    if (!DOMAIN_RE.test(d)) {
      setError("Enter a valid domain such as example.com");
      return;
    }
    setError("");
    setDomain(d);
    setLive(null);
    setOpen(null);
    setStatuses(allStatuses("running"));
    SOURCE_IDS.forEach(async (source) => {
      let next: Status;
      try {
        const r = await runSource({ data: { domain: d, source } });
        next = r.ok
          ? { state: "done", names: r.names }
          : { state: "failed", names: [], error: r.error ?? "failed" };
      } catch {
        next = { state: "failed", names: [], error: "request failed" };
      }
      setStatuses((prev) => ({ ...prev, [source]: next }));
    });
  }

  async function verifyLive() {
    const found: string[] = [];
    try {
      for (let i = 0; i < merged.length; i += 40) {
        setLiveBusy(`Checking DNS ${Math.min(i + 40, merged.length)} / ${merged.length}`);
        const r = await runLive({ data: { domain, hosts: merged.slice(i, i + 40) } });
        found.push(...r.live);
      }
      setLive(found.sort());
    } catch {
      setError("Live check failed. Try again.");
    } finally {
      setLiveBusy("");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(shown.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const started = domain !== "";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
          passive recon / subdomain enumeration
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Sub<span className="text-primary">Hunt</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          One domain in. Eleven public sources queried at once. One merged, de-duplicated list out.
        </p>
      </header>

      <form onSubmit={start} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.com"
          aria-label="Target domain"
          className="h-12 flex-1 bg-card font-mono text-base"
          autoFocus
        />
        <Button type="submit" size="lg" disabled={running} className="h-12 px-8 font-mono">
          {running ? "scanning…" : "Find subdomains"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Only scan domains you own or are authorised to test. Uses public data only; the target is
        never contacted directly.
      </p>

      {started && (
        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-2">
            <h2 className="mb-3 font-mono text-sm uppercase tracking-widest text-muted-foreground">
              Sources
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {SOURCE_IDS.map((s) => {
                const st = statuses[s];
                return (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={st.state !== "done" || st.names.length === 0}
                      onClick={() => setOpen(open === s ? null : s)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left font-mono text-sm enabled:hover:bg-accent disabled:cursor-default"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={
                            "h-2 w-2 rounded-full " +
                            (st.state === "running"
                              ? "animate-scan bg-warn"
                              : st.state === "done"
                                ? "bg-primary"
                                : st.state === "failed"
                                  ? "bg-destructive"
                                  : "bg-muted-foreground")
                          }
                        />
                        {s}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {st.state === "running" && "scanning…"}
                        {st.state === "done" && `${st.names.length} found`}
                        {st.state === "failed" && (st.error ?? "failed")}
                      </span>
                    </button>
                    {open === s && (
                      <pre className="max-h-48 overflow-auto border-t border-border bg-background px-4 py-2 font-mono text-xs text-muted-foreground">
                        {st.names.join("\n")}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                {live ? "Live subdomains" : "Merged unique"} for {domain}
              </h2>
              <p className="font-mono text-xs text-muted-foreground">
                {totalRaw} hits → <span className="text-primary">{merged.length} unique</span>
                {live && ` → ${live.length} live`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pb-3">
              <Button
                variant="outline"
                size="sm"
                disabled={shown.length === 0}
                onClick={() =>
                  download(
                    `${domain}_${live ? "live" : "merged_unique"}.txt`,
                    shown.join("\n") + "\n",
                  )
                }
              >
                Download .txt
              </Button>
              <Button variant="outline" size="sm" disabled={shown.length === 0} onClick={copy}>
                {copied ? "Copied" : "Copy list"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={running || merged.length === 0 || !!liveBusy}
                onClick={verifyLive}
              >
                {liveBusy || (live ? "Re-check live hosts" : "Keep only live (DNS check)")}
              </Button>
              {live && (
                <Button variant="ghost" size="sm" onClick={() => setLive(null)}>
                  Show all merged
                </Button>
              )}
            </div>

            <pre className="glow-signal h-[28rem] overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-sm leading-relaxed">
              {shown.length
                ? shown.join("\n")
                : running
                  ? "waiting for sources…"
                  : "no subdomains found"}
            </pre>
          </section>
        </div>
      )}
    </main>
  );
}
