/**
 * Code 128 (set B) barcodes, which every normal scanner reads. It covers all SKU characters.
 * Each symbol is 11 modules: 1 = bar, 0 = space.
 */
const PATTERNS = [
  '11011001100',
  '11001101100',
  '11001100110',
  '10010011000',
  '10010001100',
  '10001001100',
  '10011001000',
  '10011000100',
  '10001100100',
  '11001001000',
  '11001000100',
  '11000100100',
  '10110011100',
  '10011011100',
  '10011001110',
  '10111001100',
  '10011101100',
  '10011100110',
  '11001110010',
  '11001011100',
  '11001001110',
  '11011100100',
  '11001110100',
  '11101101110',
  '11101001100',
  '11100101100',
  '11100100110',
  '11101100100',
  '11100110100',
  '11100110010',
  '11011011000',
  '11011000110',
  '11000110110',
  '10100011000',
  '10001011000',
  '10001000110',
  '10110001000',
  '10001101000',
  '10001100010',
  '11010001000',
  '11000101000',
  '11000100010',
  '10110111000',
  '10110001110',
  '10001101110',
  '10111011000',
  '10111000110',
  '10001110110',
  '11101110110',
  '11010001110',
  '11000101110',
  '11011101000',
  '11011100010',
  '11011101110',
  '11101011000',
  '11101000110',
  '11100010110',
  '11101101000',
  '11101100010',
  '11100011010',
  '11101111010',
  '11001000010',
  '11110001010',
  '10100110000',
  '10100001100',
  '10010110000',
  '10010000110',
  '10000101100',
  '10000100110',
  '10110010000',
  '10110000100',
  '10011010000',
  '10011000010',
  '10000110100',
  '10000110010',
  '11000010010',
  '11001010000',
  '11110111010',
  '11000010100',
  '10001111010',
  '10100111100',
  '10010111100',
  '10010011110',
  '10111100100',
  '10011110100',
  '10011110010',
  '11110100100',
  '11110010100',
  '11110010010',
  '11011011110',
  '11011110110',
  '11110110110',
  '10101111000',
  '10100011110',
  '10001011110',
  '10111101000',
  '10111100010',
  '11110101000',
  '11110100010',
  '10111011110',
  '10111101110',
  '11101011110',
  '11110101110',
] as const;

const START_B = '11010010000';
const START_B_VALUE = 104;
const STOP = '1100011101011';
/** Blank space on each side, in modules. Scanners need it to find the code. */
export const QUIET_ZONE_MODULES = 10;

/** The bars and spaces for a text. Throws on characters Code 128 set B cannot hold. */
export function encodeCode128(text: string): string {
  let checksum = START_B_VALUE;
  let bars = START_B;
  [...text].forEach((character, index) => {
    const value = character.charCodeAt(0) - 32;
    const pattern = PATTERNS[value];
    if (pattern === undefined || value > 94) {
      throw new Error(`Character "${character}" cannot be used in a barcode`);
    }
    bars += pattern;
    checksum += value * (index + 1);
  });
  return bars + PATTERNS[checksum % 103] + STOP;
}

/** Full width including quiet zones, for checking that a code fits on a label. */
export function code128Modules(text: string): number {
  return encodeCode128(text).length + QUIET_ZONE_MODULES * 2;
}
