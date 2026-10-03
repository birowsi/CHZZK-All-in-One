// Prints the AMO download URL of a signed version (owner login required to download unlisted files).
// Usage: node qa/amo-download-url.mjs <version>   (needs WEB_EXT_API_KEY / WEB_EXT_API_SECRET)
import crypto from "node:crypto";
const version = process.argv[2];
const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ iss: process.env.WEB_EXT_API_KEY, jti: crypto.randomUUID(), iat, exp: iat + 60 });
const signature = crypto.createHmac("sha256", process.env.WEB_EXT_API_SECRET).update(`${head}.${body}`).digest("base64url");
const response = await fetch("https://addons.mozilla.org/api/v5/addons/addon/chzzk-all-in-one@hanbi/versions/?filter=all_with_unlisted&page_size=10", {
  headers: { Authorization: `JWT ${head}.${body}.${signature}` },
});
if (!response.ok) throw new Error(`AMO versions HTTP ${response.status}`);
const match = (await response.json()).results?.find((item) => item.version === version);
if (!match?.file?.url) throw new Error(`AMO version ${version} not found`);
console.log(match.file.url);
