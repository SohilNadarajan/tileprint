/**
 * xoshiro128** (Blackman and Vigna), with ECMAScript uint32 arithmetic.
 * Multiplication is Math.imul. Every stored word is forced through `>>> 0`,
 * so the sequence does not depend on the browser or the operating system.
 */

const UINT32_SPAN = 0x100000000

function rotl(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

export interface Prng {
  nextUint32(): number
  nextInt(bound: number): number
}

export function createPrng(seed: readonly [number, number, number, number]): Prng {
  const state: [number, number, number, number] = [
    seed[0] >>> 0,
    seed[1] >>> 0,
    seed[2] >>> 0,
    seed[3] >>> 0,
  ]
  if (state.every((word) => word === 0)) state[0] = 1

  function nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(state[1], 5), 7), 9) >>> 0
    const mixed = (state[1] << 9) >>> 0
    state[2] = (state[2] ^ state[0]) >>> 0
    state[3] = (state[3] ^ state[1]) >>> 0
    state[1] = (state[1] ^ state[2]) >>> 0
    state[0] = (state[0] ^ state[3]) >>> 0
    state[2] = (state[2] ^ mixed) >>> 0
    state[3] = rotl(state[3], 11)
    return result
  }

  /** Uniform integer in `0 .. bound-1`, with rejection sampling so the low bits are unbiased. */
  function nextInt(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0 || bound > UINT32_SPAN) {
      throw new Error(`PRNG bound must be an integer from 1 to 2^32`)
    }
    const limit = UINT32_SPAN - (UINT32_SPAN % bound)
    let sample = nextUint32()
    while (sample >= limit) sample = nextUint32()
    return sample % bound
  }

  return { nextUint32, nextInt }
}

/**
 * Seed from a 32-byte SHA-256 digest.
 * The four state words are little-endian uint32s from bytes 0–15,
 * each XOR-mixed with the little-endian uint32 in bytes 16–31.
 * An all-zero state, which SHA-256 does not produce, would become [1, 0, 0, 0].
 */
export function seedFromSha256(digest: Uint8Array): [number, number, number, number] {
  if (digest.length !== 32) throw new Error('SHA-256 digest must be 32 bytes')
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength)
  return [0, 1, 2, 3].map((index) => (view.getUint32(index * 4, true) ^ view.getUint32(16 + index * 4, true)) >>> 0) as [
    number,
    number,
    number,
    number,
  ]
}
