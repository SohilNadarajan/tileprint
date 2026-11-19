# Tileprint

Tileprint is a small studio for geometric origami art. Type a name, place, or title and it composes an 8×8 sheet of 1×1 and 2×2 tiles. The sheet is a fingerprint of the text: the same message always produces the same pattern, and the pattern cannot be reversed to recover the message.

Everything runs in the browser. There is no account, database, or shared catalog. Each saved artwork is its own frame.

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints.

```bash
npm test        # fingerprint, export, and gallery tests
npm run build   # typecheck and production build
npm run lint
```

## Using the studio

The field starts with `NARA`. The sheet updates as you type.

**Generator.** Any UTF-8 text is accepted, including long titles. The message is normalized before hashing: Unicode NFC, trimmed ends, then the Unicode default lowercase mapping (`String.prototype.toLowerCase`, not a locale mapping). Interior spaces and punctuation stay. `NARA`, `nara`, and `  Nara  ` are one fingerprint.

**Pattern.** The panel shows the original message, the normalized message, the large and small tile counts, the encoding version, and an identifier such as `TP-7E90C160`. That identifier names the canonical geometry. Changing colors, borders, spacing, or the display rotation does not change it.

**Color.** Warm Neutral, Monochrome, Ocean Blue, and Cherry Blossom are two-tone presets. TANT Blue, TANT Yellow, TANT Green, and TANT Red are twelve-color families in `src/config/palettes.ts`. On a TANT palette, large tiles start as swatch 1 and small tiles start as swatch 12. Choose a numbered swatch and turn on Paint tiles, then click a 1×1 or a 2×2. A 2×2 is one physical piece and takes one color. Small tiles, large tiles, and the paper can also be set with hex colors. A hex that is not one of the twelve swatches is custom: it keeps its color and shows no number.

**Display.** Rotate the view by 0°, 90°, 180°, or 270°. Show color numbers is off until you turn it on. The number is the palette swatch, drawn once at the center of each physical tile, and it stays centered when the sheet is rotated. Turn tile outlines on or off, and change their color and thickness. Adjust the gap between tiles. The frame preview shows the sheet inside a mat.

**Verify.** Enter a candidate message and rebuild a sheet by clicking. Compare reports Match or No match. The comparison uses the canonical rotation, so turning the rebuilt sheet still matches. Colors are ignored. A fingerprint cannot be read backwards into the text that produced it.

**Export.** SVG is the sharp master. PNG is a 3000×3000 image of that same drawing. Both include the color numbers only while Show color numbers is on, so the file can be an assembly guide. JSON records version `v3`, the SHA-256 of the normalized message, the canonical tile coordinates, the palette, each tile’s hex and swatch number, the display rotation, and any creative edits. A custom hex has a null swatch.

**Collection.** Save keeps the piece in `localStorage` under `tileprint.gallery.v3`, including the palette, tile colors, custom colors, and whether numbers are visible. Older v3 saves that omit those fields still open. Records under `tileprint.gallery.v1` and `tileprint.gallery.v2` are left untouched and are not read as v3 fingerprints. Open a thumbnail to bring a piece back, or delete it.

## TANT palettes

Each TANT family has twelve colors, numbered 1–12 in the order printed on the paper packaging: left to right, then top to bottom. The hex values are approximate digital readings of that packaging. They are not manufacturer-certified color specifications. The sheet behind the tiles stays the studio paper `#f6f1e8` and is not a numbered swatch.

| Number | TANT Blue | TANT Yellow | TANT Green | TANT Red |
| --- | --- | --- | --- | --- |
| 1 | `#027EBF` | `#FFC901` | `#2D973E` | `#F23102` |
| 2 | `#008BB7` | `#FEBB02` | `#1C6A2D` | `#A92A05` |
| 3 | `#09689A` | `#FD9301` | `#336C1D` | `#83160C` |
| 4 | `#122F7A` | `#F37804` | `#567B1C` | `#4E1913` |
| 5 | `#474C90` | `#F96102` | `#5AAE39` | `#F44903` |
| 6 | `#074E85` | `#FA4E02` | `#87BE47` | `#82132C` |
| 7 | `#1E4886` | `#DC7805` | `#8DC047` | `#B8124B` |
| 8 | `#319FCF` | `#FFD900` | `#C7D43E` | `#E49599` |
| 9 | `#8B8DC3` | `#FDD201` | `#9DCB83` | `#F3C5C9` |
| 10 | `#3CA0BC` | `#FEE401` | `#C0D5AC` | `#C88388` |
| 11 | `#35B1D8` | `#FAE374` | `#D1DB97` | `#EBB2A0` |
| 12 | `#AAD7E9` | `#F8E58B` | `#DCE0AE` | `#F4D0B7` |

Switching from one TANT family to another keeps each tile on the same number. TANT Blue 4 (`#122F7A`) becomes TANT Yellow 4 (`#F37804`). A custom hex that matches no swatch is left as it is. Entering or leaving a TANT family clears individual tile colors and applies that preset. Color, numbers, and rotation never change the fingerprint identifier.

## Creative mode

Creative mode edits the sheet on screen. It does not replace the fingerprint of the typed message.

- Click a large tile to split it into four small tiles.
- Small marks show where four small tiles can become one large tile. Click that region to merge them.
- A sheet cannot grow past 7 large tiles.
- Reset to fingerprint restores the canonical arrangement.
- The caption says when the tiles on screen no longer match that fingerprint.

## Tileprint v3

This section is the specification of the fingerprint. Changing it changes patterns that may already exist as physical artworks. The tests in `src/lib/tileprint.test.ts` lock the generator and the reference vectors below.

The implementation is `src/lib/prng.ts` and `src/lib/fingerprint.ts`. Geometry and rotation live in `src/lib/geometry.ts`.

### Normalization and hash

```text
normalized = NFC(text).trim().toLowerCase()
payload    = UTF-8("tileprint:v3:" + normalized)
digest     = SHA-256(payload)
```

SHA-256 is the Web Crypto `crypto.subtle.digest('SHA-256', payload)` operation. A blank message after trimming has no fingerprint. The digest is stored as 64 lowercase hex digits. For `nara` it is `768c1c18e03c1f16682f971abe5086bdd9abc5458e9e22a04ba9403f4228e588`.

### Generator

The pseudorandom generator is xoshiro128** (Blackman and Vigna), using ECMAScript uint32 arithmetic: `Math.imul` for multiplication, and `>>> 0` after every stored word and shift.

`rotl(x, k) = ((x << k) | (x >>> (32 - k))) >>> 0`

One step, with state words `s0, s1, s2, s3`:

```text
result = rotl((s1 * 5) >>> 0, 7) * 9, then >>> 0
t      = (s1 << 9) >>> 0
s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t
s3 = rotl(s3, 11)
```

Seed state `[1, 2, 3, 4]` yields `11520, 0, 5927040, 70819200`.

The seed is four little-endian uint32 values. Word `i` is bytes `4i .. 4i+3` of the digest XOR bytes `16+4i .. 19+4i`. An all-zero state would be replaced by `[1, 0, 0, 0]`. SHA-256 does not produce that state.

`nextInt(bound)` draws `nextUint32()` until the sample is strictly below `2^32 - (2^32 mod bound)`, then returns `sample mod bound`. That removes modulo bias. The bound in this algorithm is only 4 or at most 49.

### Placement

A large tile’s origin is its top-left cell. Row and column are each in `0..6`, so there are 49 origins. They start in row-major order: row 0 through 6, and within a row column 0 through 6. Two origins overlap when their Chebyshev distance is less than 2. Tiles may touch. Every other cell is a 1×1 tile.

Draws happen in this order, and in no other order:

1. `count = 4 + nextInt(4)`.
2. Fisher–Yates shuffle of the 49 origins. For `i` from 48 down to 1, swap position `i` with position `nextInt(i + 1)`.
3. No further random draws. Placement only reads that order.

Walk the shuffled origins three times, at Chebyshev separation 4, then 3, then 2. Accept an origin when its distance to every accepted tile is at least the current separation. Stop at `count` tiles. Separation 4 and 3 leave a gap between large tiles. Separation 2 is the non-overlapping rule. If those three passes still hold fewer than `count` tiles, search the same order depth-first for any non-overlapping selection of exactly `count`, trying earlier origins first and pruning when the remaining origins cannot finish the count. The search is finite. A complete selection of 4 to 7 tiles always exists on this board.

### Canonical arrangement

Clockwise rotation of a cell `(r, c)`:

```text
90°   (r, c) → (c, 7 − r)
180°  (r, c) → (7 − r, 7 − c)
270°  (r, c) → (7 − c, r)
```

A large tile’s new origin is the minimum row and minimum column among its four rotated cells. Mirror images are different fingerprints.

Sort origins by row, then column. Serialize each as two decimal digits with no separator, so `(0,3)` then `(6,6)` is `0366`. The canonical arrangement is the rotation whose serialization is lexicographically smallest. A tie keeps the smaller clockwise angle. That serialization is the artwork’s identity.

The pattern identifier is FNV-1a 32-bit over the bytes of that serialization (they are ASCII digits). The offset basis is `2166136261` and the prime is `16777619`, both with `Math.imul` and a final `>>> 0`. The identifier is `TP-` plus eight uppercase hex digits. It names the geometry, so recoloring a sheet does not change it. Two different messages can land on one pattern. That collision is accepted.

### Reference vectors

| Message | Serialization | Identifier | Large tiles |
| --- | --- | --- | --- |
| `NARA` | `00030635506366` | `TP-7E90C160` | (0,0) (0,3) (0,6) (3,5) (5,0) (6,3) (6,6) |
| `Kyoto` | `00145166` | `TP-58007656` | (0,0) (1,4) (5,1) (6,6) |
| `GOLDEN GATE BRIDGE` | `001316305662` | `TP-35C1AB5A` | (0,0) (1,3) (1,6) (3,0) (5,6) (6,2) |

`NARA` normalizes to `nara`. Its digest is the hex value in the hash section above.

### Earlier versions

Tileprint v2 ranked rotation classes and could recover a short message from the sheet. v1 was an earlier SHA-256 fingerprint with a different prefix and a different placement rule. Neither is v3. Saved v1 and v2 pieces are not reinterpreted, and a v3 pattern must not be substituted for them.
