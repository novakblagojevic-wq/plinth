/**
 * PLINTH_SPEC §2.1 — "No brands." Denylist of device manufacturer and product
 * names that must never appear in src/ or README.md. Devices in this product
 * are parametric generic slabs named by class (phone, tablet, laptop, browser,
 * card), never by product.
 *
 * Each entry is a case-insensitive regex. Bare words are word-bounded. Names
 * that are also ordinary 3D / English vocabulary (surface, pixel, mate, nord,
 * blade, swift …) are anchored to the product form so `surface roughness` or
 * `setPixelRatio` do not trip the guard while `Surface Pro` and `Pixel 9` do.
 *
 * Deliberately NOT listed: "Nothing" (the phone maker) — the bare word is too
 * common to grep for; the reviewer's eye is the guard for that one.
 */
export const DENYLIST: ReadonlyArray<RegExp> = [
  // Manufacturers.
  /\bapple\b/i,
  /\bsamsung\b/i,
  /\bgoogle\b/i,
  /\bmicrosoft\b/i,
  /\bhuawei\b/i,
  /\bxiaomi\b/i,
  /\boneplus\b/i,
  /\boppo\b/i,
  /\bvivo\b/i,
  /\brealme\b/i,
  /\bmotorola\b/i,
  /\bnokia\b/i,
  /\bsony\b/i,
  /\bhtc\b/i,
  /\basus\b/i,
  /\bacer\b/i,
  /\bdell\b/i,
  /\blenovo\b/i,
  /\brazer\b/i,
  /\bhonor\b/i,
  /\bfairphone\b/i,
  /\bblackberry\b/i,
  /\balcatel\b/i,
  /\bzte\b/i,
  /\btoshiba\b/i,
  /\bfujitsu\b/i,
  /\bmsi\b/i,
  /\bhewlett[- ]?packard\b/i,
  /\bHP\b/,
  /\bLG\b/,
  // Phones and tablets.
  /\biphone\b/i,
  /\bipad\b/i,
  /\bipod\b/i,
  /\bgalaxy\b/i,
  /\bpixel\s?(?:\d|fold|tablet|slate|book|pro|xl)\b/i,
  /\bnexus\s?\d/i,
  /\bxperia\b/i,
  /\blumia\b/i,
  /\bredmi\b/i,
  /\bpoco\b/i,
  /\bmi\s?pad\b/i,
  /\bmate\s?(?:\d|pad|book|x)\b/i,
  /\bp\d{2}\s?pro\b/i,
  /\boneplus\s?nord\b/i,
  /\bfind\s?x\d/i,
  /\breno\s?\d/i,
  /\bmoto\s?[gexz]\b/i,
  /\brazr\b/i,
  /\bkindle\b/i,
  /\bfire\s?hd\b/i,
  /\bzenfone\b/i,
  /\bmagic\s?pad\b/i,
  // Laptops and desktops.
  /\bmacbook\b/i,
  /\bimac\b/i,
  /\bmac\s?(?:mini|studio|pro)\b/i,
  /\bsurface\s?(?:pro|laptop|book|go|duo|studio|hub)\b/i,
  /\bchromebook\b/i,
  /\bpixelbook\b/i,
  /\bthinkpad\b/i,
  /\bideapad\b/i,
  /\byoga\b/i,
  /\blegion\s?(?:\d|pro|slim|go)\b/i,
  /\bxps\s?\d/i,
  /\binspiron\b/i,
  /\blatitude\s?\d/i,
  /\balienware\b/i,
  /\bspectre\s?x/i,
  /\bpavilion\b/i,
  /\belitebook\b/i,
  /\benvy\s?(?:x|\d)/i,
  /\bomen\b/i,
  /\bzenbook\b/i,
  /\bvivobook\b/i,
  /\brog\s?(?:zephyrus|strix|flow|ally)\b/i,
  /\bzephyrus\b/i,
  /\baspire\s?\d/i,
  /\bpredator\b/i,
  /\bnitro\s?\d/i,
  /\bswift\s?(?:go|edge|x|\d)\b/i,
  /\brazer\s?blade\b/i,
  /\bmatebook\b/i,
  /\bframework\s?laptop\b/i,
  // Trade-marked design / display features.
  /\bretina\b/i,
  /\bdynamic\s?island\b/i,
  /\bface\s?id\b/i,
  /\btouch\s?id\b/i,
  /\btouch\s?bar\b/i,
  /\bmagic\s?(?:keyboard|mouse|trackpad)\b/i,
  /\bpromotion\b/i,
  /\bs\s?pen\b/i,
  /\bapple\s?pencil\b/i,
  /\bsuper\s?amoled\b/i,
  /\binfinity[- ]?o\b/i,
];

export interface Hit {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

export function scan(text: string, file: string): Hit[] {
  const hits: Hit[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const re of DENYLIST) {
      if (re.test(line)) {
        hits.push({ file, line: i + 1, pattern: re.source, text: line.trim() });
      }
    }
  });
  return hits;
}
