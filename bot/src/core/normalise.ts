// Turns what a student typed into the form commands are matched against.
// Matching only: the original text is kept for anything shown back.

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const TRAILING_PUNCTUATION = /[\s.!?¡¿,;:]+$/u;

export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_PUNCTUATION, "");
}
