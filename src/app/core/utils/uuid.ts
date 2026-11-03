/**
 * UUID v4 generation. We build it from `crypto.getRandomValues` instead of
 * `crypto.randomUUID`, because the latter exists only in secure contexts and
 * would be missing during live reload over the local network (http://192.168…).
 */

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function uuidV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // RFC 9562: the version nibble is 4 and the variant bits are 10xx.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** True if the value is a lowercase UUID v4. */
export function isUuidV4(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}
