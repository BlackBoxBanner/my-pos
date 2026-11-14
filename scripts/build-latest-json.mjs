#!/usr/bin/env node
/**
 * Build Tauri updater latest.json from signed release assets (.sig files).
 * Single-writer after the release matrix so parallel jobs do not race.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const REPO = "BlackBoxBanner/my-pos";

/** @typedef {{ name: string, signature: string }} SigAsset */

/**
 * @param {string} tag
 * @returns {string}
 */
export function versionFromTag(tag) {
  const trimmed = tag.trim();
  if (!trimmed) {
    throw new Error("tag is required");
  }
  return trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
}

/**
 * @param {string} sigName
 * @returns {string}
 */
export function artifactNameFromSig(sigName) {
  if (!sigName.endsWith(".sig")) {
    throw new Error(`not a .sig file: ${sigName}`);
  }
  return sigName.slice(0, -".sig".length);
}

/**
 * @param {string} artifactName
 * @returns {string | null}
 */
export function platformKeyForArtifact(artifactName) {
  const lower = artifactName.toLowerCase();
  if (lower.includes("aarch64") && lower.includes(".app.tar.gz")) {
    return "darwin-aarch64";
  }
  if (
    (lower.includes("_x64.app.tar.gz") ||
      lower.includes("x86_64.app.tar.gz")) &&
    lower.includes(".app.tar.gz")
  ) {
    return "darwin-x86_64";
  }
  if (lower.includes("-setup.exe")) {
    return "windows-x86_64";
  }
  if (lower.endsWith(".msi")) {
    return "windows-x86_64";
  }
  if (lower.endsWith(".appimage")) {
    return "linux-x86_64";
  }
  return null;
}

/**
 * Prefer NSIS (-setup.exe) over MSI when both exist for windows-x86_64.
 * @param {SigAsset[]} assets
 * @returns {Record<string, { signature: string, url: string }>}
 */
export function buildPlatforms(assets, tag, repo = REPO) {
  /** @type {Map<string, { signature: string, url: string, name: string }>} */
  const chosen = new Map();

  for (const asset of assets) {
    const artifact = artifactNameFromSig(asset.name);
    const platform = platformKeyForArtifact(artifact);
    if (!platform) continue;

    const entry = {
      signature: asset.signature.replace(/\r/g, "").trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${artifact}`,
      name: artifact,
    };

    const existing = chosen.get(platform);
    if (!existing) {
      chosen.set(platform, entry);
      continue;
    }

    // Prefer NSIS setup.exe over MSI for Windows.
    if (
      platform === "windows-x86_64" &&
      entry.name.toLowerCase().includes("-setup.exe") &&
      !existing.name.toLowerCase().includes("-setup.exe")
    ) {
      chosen.set(platform, entry);
    }
  }

  const required = [
    "darwin-aarch64",
    "darwin-x86_64",
    "windows-x86_64",
    "linux-x86_64",
  ];
  const missing = required.filter((key) => !chosen.has(key));
  if (missing.length > 0) {
    throw new Error(
      `missing updater platforms: ${missing.join(", ")} (have: ${[...chosen.keys()].join(", ") || "none"})`,
    );
  }

  /** @type {Record<string, { signature: string, url: string }>} */
  const platforms = {};
  for (const key of required) {
    const { signature, url } = chosen.get(key);
    platforms[key] = { signature, url };
  }
  return platforms;
}

/**
 * @param {{ tag: string, notes?: string, pubDate?: string, assets: SigAsset[], repo?: string }} opts
 */
export function buildLatestJson(opts) {
  const version = versionFromTag(opts.tag);
  const platforms = buildPlatforms(opts.assets, opts.tag, opts.repo ?? REPO);
  return {
    version,
    notes: opts.notes ?? "",
    pub_date: opts.pubDate ?? new Date().toISOString(),
    platforms,
  };
}

/**
 * @param {string} dir
 * @returns {SigAsset[]}
 */
export function loadSigAssetsFromDir(dir) {
  const names = readdirSync(dir).filter((n) => n.endsWith(".sig"));
  return names.map((name) => ({
    name,
    signature: readFileSync(join(dir, name), "utf8"),
  }));
}

function main(argv) {
  const args = Object.fromEntries(
    argv.slice(2).flatMap((a) => {
      const m = /^--([^=]+)=(.*)$/.exec(a);
      return m ? [[m[1], m[2]]] : [];
    }),
  );

  const tag = args.tag;
  const sigDir = args["sig-dir"];
  const out = args.out ?? "latest.json";
  const notes = args.notes ?? "";
  const repo = args.repo ?? REPO;

  if (!tag || !sigDir) {
    console.error(
      "Usage: node scripts/build-latest-json.mjs --tag=v0.1.2 --sig-dir=./sigs [--out=latest.json] [--notes=...] [--repo=owner/name]",
    );
    process.exit(1);
  }

  const assets = loadSigAssetsFromDir(sigDir);
  const json = buildLatestJson({
    tag,
    notes,
    assets,
    repo,
    pubDate: new Date().toISOString(),
  });
  writeFileSync(out, `${JSON.stringify(json, null, 2)}\n`);
  console.log(
    `wrote ${out} version=${json.version} platforms=${Object.keys(json.platforms).join(",")}`,
  );
}

if (basename(process.argv[1]) === "build-latest-json.mjs") {
  main(process.argv);
}
