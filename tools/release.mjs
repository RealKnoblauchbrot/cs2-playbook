#!/usr/bin/env node
/**
 * Bump the version everywhere, commit, tag and push. GitHub Actions then builds
 * and publishes the release, and every installed app offers the update.
 *
 *   npm run release -- 0.2.0 "Added lineup videos" "Fixed Nuke callouts"
 *   npm run release -- patch            (0.1.0 -> 0.1.1, notes from git log)
 *   npm run release -- minor --dry-run
 */
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const [target, ...noteArgs] = args.filter((a) => a !== "--dry-run");

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const run = (cmd) => {
  console.log(`$ ${cmd}`);
  if (!dry) execSync(cmd, { stdio: "inherit" });
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const current = pkg.version;
const [maj, min, pat] = current.split(".").map(Number);
const next =
  target === "major" ? `${maj + 1}.0.0`
  : target === "minor" ? `${maj}.${min + 1}.0`
  : target === "patch" ? `${maj}.${min}.${pat + 1}`
  : target;

if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error('Usage: npm run release -- <x.y.z|major|minor|patch> ["note" ...] [--dry-run]');
  process.exit(1);
}
if (sh("git status --porcelain")) {
  console.error("Working tree not clean. Commit or stash your changes first.");
  process.exit(1);
}

let notes = noteArgs.map((n) => `- ${n}`).join("\n");
if (!notes) {
  let range = "";
  try {
    range = `${sh("git describe --tags --abbrev=0")}..HEAD`;
  } catch {
    /* first release */
  }
  notes = sh(`git log ${range} --pretty=format:"- %s" --no-merges`)
    .split("\n")
    .filter((l) => l && !/^- Release v/.test(l))
    .join("\n");
}
notes ||= "- Improvements and fixes";

console.log(`\nRelease v${current} -> v${next}\n\n${notes}\n`);

const replaceIn = (file, re, value) => {
  const src = readFileSync(file, "utf8");
  if (!re.test(src)) throw new Error(`version not found in ${file}`);
  if (!dry) writeFileSync(file, src.replace(re, value));
};

pkg.version = next;
if (!dry) writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
replaceIn("package-lock.json", /("name": "cs2-playbook",\s*"version": ")[^"]+/, `$1${next}`);
replaceIn("package-lock.json", /("packages": \{\s*"": \{\s*"name": "cs2-playbook",\s*"version": ")[^"]+/, `$1${next}`);
replaceIn("src-tauri/tauri.conf.json", /("version": ")[^"]+/, `$1${next}`);
replaceIn("src-tauri/Cargo.toml", /^(version = ")[^"]+/m, `$1${next}`);
replaceIn("src-tauri/Cargo.lock", /(name = "cs2-playbook"\r?\nversion = ")[^"]+/, `$1${next}`);

const msgFile = ".release-notes.tmp";
if (!dry) writeFileSync(msgFile, `${notes}\n`);
run("git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock");
run(`git commit -m "Release v${next}"`);
run(`git tag -a v${next} -F ${msgFile} --cleanup=verbatim`);
if (!dry) unlinkSync(msgFile);
run("git push");
run(`git push origin v${next}`);
console.log(`\nDone. Watch the build: https://github.com/RealKnoblauchbrot/cs2-playbook/actions`);
