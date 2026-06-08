#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const GITHUB_BASE_URL = "https://github.com/electron-userland/electron-builder-binaries/releases/download/";
const MIRROR_BASE_URLS = [
  "https://npmmirror.com/mirrors/electron-builder-binaries/",
  GITHUB_BASE_URL,
];
const RELEASE_NAME = "dmg-builder@1.2.0";
const RELEASE_VERSION = "75c8a6c";
const CHECKSUMS = {
  "dmgbuild-bundle-arm64-75c8a6c.tar.gz": "a785f2a385c8c31996a089ef8e26361904b40c772d5ea65a36001212f1fc25e0",
  "dmgbuild-bundle-x86_64-75c8a6c.tar.gz": "87b3bb72148b11451ee90ede79cc8d59305c9173b68b0f2b50a3bea51fc4a4e2",
};

function hashUrlSafe(input, length = 5) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  hash >>>= 0;
  const value = hash.toString(36);
  return value.length >= length ? value.slice(0, length) : value.padStart(length, "0");
}

function getElectronBuilderCacheDirectory() {
  if (process.env.ELECTRON_BUILDER_CACHE?.trim()) {
    return process.env.ELECTRON_BUILDER_CACHE.trim();
  }
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Caches", "electron-builder");
  }
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || tmpdir(), "electron-builder", "Cache");
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), ".cache"), "electron-builder");
}

function getTarget() {
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const filename = `dmgbuild-bundle-${arch}-${RELEASE_VERSION}.tar.gz`;
  const suffix = hashUrlSafe(`${GITHUB_BASE_URL}-${RELEASE_NAME}-${filename}`, 5);
  const folderName = `${filename.replace(/\.(tar\.gz|tgz)$/, "")}-${suffix}`;
  const extractDir = path.join(getElectronBuilderCacheDirectory(), RELEASE_NAME, folderName);
  return {
    arch,
    filename,
    checksum: CHECKSUMS[filename],
    extractDir,
    marker: `${extractDir}.complete`,
  };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function downloadWithFallback(filename, checksum) {
  let lastError = null;
  for (const baseUrl of MIRROR_BASE_URLS) {
    const url = `${baseUrl}${RELEASE_NAME}/${filename}`;
    try {
      console.log(`Downloading macOS dmg-builder helper from ${url}`);
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const actualChecksum = createHash("sha256").update(buffer).digest("hex");
      if (actualChecksum !== checksum) {
        throw new Error(`Checksum mismatch: expected ${checksum}, got ${actualChecksum}`);
      }
      const archivePath = path.join(tmpdir(), filename);
      await writeFile(archivePath, buffer);
      return archivePath;
    } catch (error) {
      lastError = error;
      console.warn(`Download failed from ${baseUrl}: ${error.message}`);
    }
  }
  throw lastError || new Error("Unable to download dmg-builder helper");
}

async function main() {
  if (process.platform !== "darwin" && !process.argv.includes("--force")) {
    console.log("Skipping dmg-builder cache preparation on non-macOS platform.");
    return;
  }

  const target = getTarget();
  if (await exists(target.marker)) {
    console.log(`dmg-builder cache already prepared at ${target.extractDir}`);
    return;
  }

  if (!target.checksum) {
    throw new Error(`Unsupported dmg-builder helper architecture: ${target.arch}`);
  }

  await mkdir(path.dirname(target.extractDir), { recursive: true });
  const archivePath = await downloadWithFallback(target.filename, target.checksum);
  await rm(target.extractDir, { recursive: true, force: true });
  await mkdir(target.extractDir, { recursive: true });
  await run("tar", ["-xzf", archivePath, "-C", target.extractDir, "--strip-components", "1"]);
  await writeFile(target.marker, "");
  console.log(`Prepared dmg-builder cache at ${target.extractDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
