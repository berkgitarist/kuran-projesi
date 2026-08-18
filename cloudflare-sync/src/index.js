const SOURCE_URL =
  "https://raw.githubusercontent.com/SubmitterTech/quran-tft/main/app/src/assets/translations/tr/quran_tr.json";

const LIVE_HASH_URL =
  "https://kuranteyit.com/data/quran_tr.source.sha256";

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(digest);
}

async function getSourceHash() {
  const response = await fetch(
    `${SOURCE_URL}?kuran_teyit_sync=${Date.now()}`,
    {
      headers: {
        "User-Agent": "KuranTeyit-QuranSync/1.0",
        "Cache-Control": "no-cache"
      },
      cf: {
        cacheTtl: 0
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Kaynak quran_tr indirilemedi: HTTP ${response.status}`
    );
  }

  const bytes = await response.arrayBuffer();

  if (bytes.byteLength < 500000 || bytes.byteLength > 5000000) {
    throw new Error(
      `Kaynak quran_tr boyutu supheli: ${bytes.byteLength}`
    );
  }

  const text = new TextDecoder()
    .decode(bytes)
    .replace(/^\uFEFF/, "");

  try {
    JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Kaynak quran_tr JSON gecersiz: ${error.message}`
    );
  }

  return sha256(bytes);
}

async function getLiveHash() {
  const response = await fetch(
    `${LIVE_HASH_URL}?kuran_teyit_sync=${Date.now()}`,
    {
      headers: {
        "Cache-Control": "no-cache"
      },
      cf: {
        cacheTtl: 0
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Canli hash okunamadi: HTTP ${response.status}`
    );
  }

  const hash = (await response.text())
    .trim()
    .toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(
      `Canli hash gecersiz: ${hash}`
    );
  }

  return hash;
}

async function checkAndDeploy(env) {
  const sourceHash = await getSourceHash();
  const liveHash = await getLiveHash();

  console.log(`Kaynak SHA256: ${sourceHash}`);
  console.log(`Canli  SHA256: ${liveHash}`);

  if (sourceHash === liveHash) {
    console.log("quran_tr degismedi. Deploy gerekmiyor.");
    return;
  }

  console.log("quran_tr degisti. Deploy tetikleniyor.");

  const deployResponse = await fetch(
    env.DEPLOY_HOOK_URL,
    {
      method: "POST"
    }
  );

  const body = await deployResponse.text();

  if (!deployResponse.ok) {
    throw new Error(
      `Deploy Hook basarisiz. HTTP ${deployResponse.status}: ${body}`
    );
  }

  console.log("Yeni Kuran Teyit build'i tetiklendi.");
  console.log(body);
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      checkAndDeploy(env).catch((error) => {
        console.error("Quran sync hatasi:", error);
        throw error;
      })
    );
  }
};