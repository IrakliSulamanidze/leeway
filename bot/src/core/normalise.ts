// Turns what a student typed into the form commands are matched against.
// Matching only: the original text is kept for anything shown back.

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const TRAILING_PUNCTUATION = /[\s.!?¡¿,;:]+$/u;

// Phone keyboards type curly quotes; NFKC leaves them as they are.
const CURLY_APOSTROPHE = /[\u2018\u2019\u02BC]/g;

export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(CURLY_APOSTROPHE, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_PUNCTUATION, "");
}
