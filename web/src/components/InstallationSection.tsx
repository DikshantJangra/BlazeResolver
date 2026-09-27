"use client";

import React, { useState } from "react";
import { FaGithub, FaBook, FaTerminal, FaCheck, FaCopy, FaBolt } from "react-icons/fa6";
import Link from "next/link";

const INIT = "npx blazeresolver@latest init";

const SETUP_STEPS = [
  { title: "Run init in your repo", body: "Writes the workflow, the report route, the config and your .env (kept out of git)." },
  { title: "Add two keys", body: "BLAZE_GITHUB_TOKEN (Issues write, this repo only) and any AI key as API_KEYS." },
  { title: "Give Actions the AI key", body: "gh secret set API_KEYS, then allow Actions to open pull requests." },
  { title: "Paste the widget tag", body: "One script tag before </body>. Reports start arriving as issues." },
];

export default function InstallationSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INIT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section
      id="get-started"
      className="relative z-10 ds-container flex flex-col items-center text-center scroll-mt-24 py-20 sm:py-28"
    >
      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-fg/[0.05] border border-fg/10 backdrop-blur-xl mb-4">
        <FaBolt className="w-3 h-3 text-brand" />
        <span className="font-mono text-xs font-semibold text-fg/90 uppercase tracking-wider">
          Five-minute setup
        </span>
      </span>

      <h2 className="text-3xl sm:text-5xl font-bold font-ds-display text-fg tracking-tight leading-[1.15] max-w-[820px]">
        Add BlazeResolver to your repo
      </h2>

      <p className="mt-4 text-base sm:text-lg text-fg/70 leading-relaxed max-w-[680px]">
        Works with any web app and any GitHub repo. Next.js gets the report
        route written for you; other backends get a two-line snippet. Updates
        arrive on their own: the widget loads from a CDN and the workflow runs
        the latest release.
      </p>

      <div className="mt-8 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface border border-fg/[0.12] text-xs font-mono text-fg/90 shadow-xl max-w-[420px] w-full justify-between">
        <div className="flex items-center gap-2 truncate">
          <span className="text-brand font-bold">$</span>
          <span className="truncate">{INIT}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy setup command"
          className="p-1.5 rounded-lg bg-fg/5 hover:bg-fg/15 text-fg/60 hover:text-fg transition-colors cursor-pointer shrink-0"
        >
          {copied ? <FaCheck className="w-3.5 h-3.5 text-ok" /> : <FaCopy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <ol className="mt-10 w-full max-w-[960px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {SETUP_STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-fg/[0.08] bg-surface/70 p-5 flex flex-col gap-2">
            <span className="font-mono text-xs text-brand font-semibold">0{i + 1}</span>
            <span className="text-sm font-bold text-fg">{s.title}</span>
            <span className="text-xs text-fg/60 leading-relaxed">{s.body}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
        <a
          className="ds-btn-primary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
          href="https://github.com/DikshantJangra/BlazeResolver"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaGithub className="w-4 h-4" />
          <span>View on GitHub</span>
        </a>
        <Link
          className="ds-btn-secondary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
          href="/docs/quickstart"
        >
          <FaBook className="w-4 h-4" />
          <span>Documentation</span>
        </Link>
        <a
          className="ds-btn-secondary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
          href="https://www.npmjs.com/package/blazeresolver"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaTerminal className="w-4 h-4" />
          <span>npm package</span>
        </a>
      </div>
    </section>
  );
}
