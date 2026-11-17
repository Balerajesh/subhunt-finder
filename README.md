# SubHunt — Subdomain Finder

A web tool that finds subdomains of any domain by querying multiple free
sources at once, then merges everything into one clean, unique list you can
download for the next step of your recon workflow.

**Live demo:** https://subhunt-finder.lovable.app

## What it does

- Type a domain, click **Find subdomains**.
- Each source reports its own results as it finishes, with per-source progress.
- The merged, de-duplicated list is shown on the right — **Download .txt** or
  **Copy list** for use in the next step of your pipeline.
- **Keep only live (DNS check)** trims the list to subdomains that actually
  resolve, using DNS-over-HTTPS.

## Sources queried

crt.sh, HackerTarget, Anubis, AlienVault OTX, URLScan.io, RapidDNS, ThreatCrowd,
and BufferOver — all free, no API keys required.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19 + SSR)
- TypeScript
- Tailwind CSS v4
- shadcn/ui components

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) 20 or newer (install with
  [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) if needed)
- npm (comes with Node.js) — or [Bun](https://bun.sh) if you prefer

### Setup

```sh
# 1. Clone the repository
git clone https://github.com/<your-username>/subhunt-finder.git
cd subhunt-finder

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open http://localhost:8080 in your browser.

### Production build

```sh
npm run build
npm run preview
```

### Other commands

```sh
npm run test    # run the test suite (vitest)
npm run lint    # lint the code
```

## Project structure

```text
src/
├── routes/
│   ├── __root.tsx                  # app shell
│   └── index.tsx                   # the subdomain finder page
├── lib/
│   ├── subdomain-sources.server.ts # the per-source query logic (server side)
│   ├── subdomains.functions.ts     # server functions the page calls
│   └── subdomain-source-list.ts    # shared list of sources
└── components/ui/                  # shadcn/ui components
```

## Notes & limitations

- Only use this on domains you are authorised to test.
- This web version queries free online sources only. Local tools such as
  Subfinder, Amass or Gobuster must run on your own machine and are not part
  of this app.
- Some sources rate-limit or occasionally block requests; the app continues
  with the remaining sources when that happens.

## License

[MIT](LICENSE)
"# subhunt-finder" 
