// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
// Keep the iteration count encoded in each hash so verification remains versioned.
const ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `v1:${ITERATIONS}:${bytesToBase64(salt)}:${bytesToBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [version, iterationsText, saltText, hashText] = stored.split(":");
  if (version !== "v1" || !iterationsText || !saltText || !hashText) return false;
  const expected = base64ToBytes(hashText);
  const actual = await derive(password, base64ToBytes(saltText), Number(iterationsText));
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
