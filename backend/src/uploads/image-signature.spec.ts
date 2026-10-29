import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-signature';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function webp(): Buffer {
  return Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
  ]);
}

describe('detectImageType', () => {
  it('detects JPEG', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe('image/jpeg');
  });

  it('detects PNG', () => {
    expect(detectImageType(Buffer.from([...PNG_HEADER, 0, 0, 0, 13]))).toBe('image/png');
  });

  it('detects WebP', () => {
    expect(detectImageType(webp())).toBe('image/webp');
  });

  it('rejects plain text', () => {
    expect(detectImageType(Buffer.from('this is not an image'))).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a truncated PNG header', () => {
    expect(detectImageType(Buffer.from(PNG_HEADER.slice(0, 5)))).toBeNull();
  });

  it('rejects a 2-byte JPEG start', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('rejects a RIFF file that is not WebP (for example WAV)', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0, 0, 0]),
      Buffer.from('WAVE'),
    ]);
    expect(detectImageType(wav)).toBeNull();
  });

  it('rejects an executable header (MZ)', () => {
    expect(detectImageType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it('rejects a GIF (not an allowed type)', () => {
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
  });
});
