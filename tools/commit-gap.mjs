#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function hasGitRepo() {
  try {
    git(["rev-parse", "--show-toplevel"]);
    return true;
  } catch {
    return false;
  }
}

function stagedDiffNameOnly() {
  return git(["diff", "--cached", "--name-only"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function unstagedDiffNameOnly() {
  return git(["diff", "--name-only"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function stagedDiffSummary() {
  try {
    return git(["diff", "--cached", "--stat"]);
  } catch {
    return "";
  }
}

function inferType(files, gapId) {
  if (gapId || files.some((file) => file.includes("fixtures/openImplementations"))) {
    return "fix";
  }
  if (files.some((file) => file.includes("test") || file.includes("spec"))) {
    return "test";
  }
  if (files.some((file) => file.endsWith(".md"))) {
    return "docs";
  }
  return "fix";
}

function inferScope(files, fallback) {
  if (fallback) {
    return fallback;
  }

  if (files.some((file) => file.includes("BeatPacker"))) {
    return "beatpacker";
  }
  if (files.some((file) => file.includes("HarpnotesLayout"))) {
    return "layout";
  }
  if (files.some((file) => file.includes("extractSongConfig"))) {
    return "config";
  }
  if (files.some((file) => file.includes("SvgEngine"))) {
    return "svg";
  }
  if (files.some((file) => file.includes("AbcToSong"))) {
    return "song";
  }

  return "core";
}

function sentenceFromGap(gapId) {
  if (!gapId) {
    return "";
  }
  return gapId
    .replace(/^sheet\./, "")
    .replace(/^song\./, "")
    .replaceAll("-", " ");
}

function buildMessage({ type, scope, summary, body, tests, remaining, files, stat }) {
  const lines = [];
  lines.push(`${type}(${scope}): ${summary}`);
  lines.push("");

  if (body) {
    lines.push(body.trim());
    lines.push("");
  }

  if (files.length > 0) {
    lines.push("Changed:");
    for (const file of files) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  if (tests.length > 0) {
    lines.push("Verified:");
    for (const test of tests) {
      lines.push(`- ${test}`);
    }
    lines.push("");
  }

  if (remaining) {
    lines.push("Remaining:");
    for (const item of remaining.split("\n").map((line) => line.trim()).filter(Boolean)) {
      lines.push(`- ${item.replace(/^- /, "")}`);
    }
    lines.push("");
  }

  if (stat) {
    lines.push("Diff summary:");
    lines.push(stat);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  if (!hasGitRepo()) {
    console.error("Not inside a git repository.");
    process.exit(1);
  }

  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [key, ...valueParts] = arg.split("=");
    if (key.startsWith("--")) {
      args.set(key.slice(2), valueParts.join("=") || "true");
    }
  }

  const stagedFiles = stagedDiffNameOnly();
  const unstagedFiles = unstagedDiffNameOnly();

  if (stagedFiles.length === 0) {
    console.error("No staged changes. Stage files first, for example: git add <files>");
    if (unstagedFiles.length > 0) {
      console.error("\nUnstaged files:");
      for (const file of unstagedFiles) {
        console.error(`- ${file}`);
      }
    }
    process.exit(1);
  }

  const rl = createInterface({ input, output });

  const gapId = args.get("gap") ?? await rl.question("Gap ID (optional): ");
  const scopeInput = args.get("scope") ?? await rl.question(`Scope [${inferScope(stagedFiles, "")}]: `);
  const scope = inferScope(stagedFiles, scopeInput.trim());
  const type = args.get("type") ?? inferType(stagedFiles, gapId.trim());

  const defaultSummary = gapId.trim()
    ? `fix ${sentenceFromGap(gapId.trim())}`
    : "update implementation";
  const summaryInput = args.get("summary") ?? await rl.question(`Summary [${defaultSummary}]: `);
  const summary = summaryInput.trim() || defaultSummary;

  const defaultBody = gapId.trim()
    ? `Aligns the TypeScript implementation with legacy behavior for ${gapId.trim()}.`
    : "Updates the implementation with a minimal, scoped change.";
  const bodyInput = args.get("body") ?? await rl.question(`Body [${defaultBody}]: `);
  const body = bodyInput.trim() || defaultBody;

  const testsInput = args.get("tests") ?? await rl.question("Verified tests (comma-separated): ");
  const tests = testsInput
    .split(",")
    .map((test) => test.trim())
    .filter(Boolean);

  const remaining = args.get("remaining") ?? await rl.question("Remaining notes (optional): ");
  rl.close();

  const stat = stagedDiffSummary();
  const message = buildMessage({
    type,
    scope,
    summary,
    body,
    tests,
    remaining: remaining.trim(),
    files: stagedFiles,
    stat,
  });

  const messageFile = ".git/COMMIT_EDITMSG";
  writeFileSync(messageFile, message, "utf8");

  console.log("\nGenerated commit message:\n");
  console.log(message);

  const shouldCommit = args.get("commit") === "true";
  if (shouldCommit) {
    const result = spawnSync("git", ["commit", "-F", messageFile], { stdio: "inherit" });
    process.exit(result.status ?? 1);
  }

  console.log("Message written to .git/COMMIT_EDITMSG.");
  console.log("Commit with: git commit -F .git/COMMIT_EDITMSG");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
