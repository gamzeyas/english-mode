// Minimal types for http_ece (test-only: decrypts Web Push payloads).
declare module "http_ece" {
  import type { ECDH } from "node:crypto";
  export function decrypt(
    buffer: Buffer,
    params: { version: "aes128gcm"; privateKey: ECDH; authSecret: string },
  ): Buffer;
  const ece: { decrypt: typeof decrypt };
  export default ece;
}
