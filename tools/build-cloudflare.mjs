import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SOURCE_URL =
  "https://raw.githubusercontent.com/SubmitterTech/quran-tft/main/app/src/assets/translations/tr/quran_tr.json";

const currentFile = fileURLToPath(import.meta.url);
const toolsDir = path.dirname(currentFile);
const root = path.resolve(toolsDir, "..");
const dist = path.join(root, "dist");

const requiredDirs = [
  "assets",
  "css",
  "data",
  "js"
];

const requiredFiles = [
  "index.html",
  "guide.html",
  "evidence.html",
  "privacy.html",
  "licenses.html",
  "manifest.webmanifest",
  "service-worker.js",
  "THIRD_PARTY_NOTICES.txt"
];

const optionalFiles = [
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "404.html"
];

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function rootKind(value) {
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return typeof value;
}

function rootCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }
  return 0;
}

function countStrings(value) {
  if (typeof value === "string") {
    return value.trim() ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countStrings(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .reduce((sum, item) => sum + countStrings(item), 0);
  }

  return 0;
}

console.log("Kuran Teyit Cloudflare build basladi.");

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

for (const dir of requiredDirs) {
  const source = path.join(root, dir);
  const target = path.join(dist, dir);

  if (!(await exists(source))) {
    throw new Error(`Gerekli klasor bulunamadi: ${dir}`);
  }

  await fs.cp(source, target, { recursive: true });
  console.log(`Kopyalandi: ${dir}/`);
}

for (const file of requiredFiles) {
  const source = path.join(root, file);
  const target = path.join(dist, file);

  if (!(await exists(source))) {
    throw new Error(`Gerekli dosya bulunamadi: ${file}`);
  }

  await fs.copyFile(source, target);
  console.log(`Kopyalandi: ${file}`);
}

for (const file of optionalFiles) {
  const source = path.join(root, file);

  if (await exists(source)) {
    await fs.copyFile(source, path.join(dist, file));
    console.log(`Opsiyonel dosya kopyalandi: ${file}`);
  }
}

/*
  GitHub'da bulunmasinda sakinca olmayan fakat
  canli siteye cikmasini istemedigimiz gelistirme scriptleri.
*/
const deployExcludes = [
  "assets/images/appendices/download-original-images.ps1",
  "assets/images/appendices/download-original-images.sh"
];

for (const relative of deployExcludes) {
  await fs.rm(path.join(dist, relative), { force: true });
}

/*
  Yerel quran_tr ile dis kaynagin ana yapisinin
  uyumlu oldugunu kontrol ediyoruz.
*/
const localQuranPath = path.join(root, "data", "quran_tr.json");

const localRaw = await fs.readFile(localQuranPath, "utf8");
const localJson = JSON.parse(stripBom(localRaw));

console.log("");
console.log("Dis quran_tr.json indiriliyor...");

const response = await fetch(
  `${SOURCE_URL}?kuran_teyit_build=${Date.now()}`,
  {
    headers: {
      "User-Agent": "KuranTeyit-Cloudflare-Build/1.0",
      "Cache-Control": "no-cache"
    }
  }
);

if (!response.ok) {
  throw new Error(
    `quran_tr indirilemedi. HTTP ${response.status}`
  );
}

const remoteBytes = Buffer.from(await response.arrayBuffer());

if (remoteBytes.length < 500000) {
  throw new Error(
    `quran_tr beklenenden cok kucuk: ${remoteBytes.length} byte`
  );
}

if (remoteBytes.length > 5000000) {
  throw new Error(
    `quran_tr beklenenden cok buyuk: ${remoteBytes.length} byte`
  );
}

const remoteText = stripBom(remoteBytes.toString("utf8"));

let remoteJson;

try {
  remoteJson = JSON.parse(remoteText);
} catch (error) {
  throw new Error(
    `Dis quran_tr gecerli JSON degil: ${error.message}`
  );
}

const localKind = rootKind(localJson);
const remoteKind = rootKind(remoteJson);

if (localKind !== remoteKind) {
  throw new Error(
    `quran_tr ana JSON tipi degisti. Yerel=${localKind}, Dis=${remoteKind}`
  );
}

const localCount = rootCount(localJson);
const remoteCount = rootCount(remoteJson);

if (
  localCount >= 10 &&
  remoteCount !== localCount
) {
  throw new Error(
    `quran_tr ana oge sayisi degisti. Yerel=${localCount}, Dis=${remoteCount}`
  );
}

const stringCount = countStrings(remoteJson);

if (stringCount < 6000) {
  throw new Error(
    `quran_tr icinde beklenen miktarda metin yok. Metin sayisi=${stringCount}`
  );
}

const hash = createHash("sha256")
  .update(remoteBytes)
  .digest("hex");

const targetQuran = path.join(
  dist,
  "data",
  "quran_tr.json"
);

const hashFile = path.join(
  dist,
  "data",
  "quran_tr.source.sha256"
);

await fs.writeFile(targetQuran, remoteBytes);
await fs.writeFile(hashFile, `${hash}\n`, "utf8");

console.log("");
console.log("quran_tr.json dogrulandi.");
console.log(`Boyut       : ${remoteBytes.length} byte`);
console.log(`Metin sayisi: ${stringCount}`);
console.log(`SHA256      : ${hash}`);

console.log("");
console.log("Cloudflare yayin paketi hazir:");
console.log(dist);