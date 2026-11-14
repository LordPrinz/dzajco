import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/** Width and height from the PNG IHDR chunk or the first JPEG start-of-frame marker. */
function imageSize(bytes: Uint8Array): { width: number; height: number } {
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("not a JPEG marker");
    const marker = bytes[i + 1] as number;
    const length = ((bytes[i + 2] as number) << 8) | (bytes[i + 3] as number);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: ((bytes[i + 5] as number) << 8) | (bytes[i + 6] as number),
        width: ((bytes[i + 7] as number) << 8) | (bytes[i + 8] as number),
      };
    }
    i += 2 + length;
  }
  throw new Error("no SOF marker");
}

describe("public/img/og.jpg", () => {
  it("is 1200x630, the size og:image advertises", () => {
    expect(imageSize(new Uint8Array(readFileSync("public/img/og.jpg")))).toEqual({
      width: 1200,
      height: 630,
    });
  });
});
