// Course names from calendar keys, shared by the calendar page and its actions.

export const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// "STATISTICS II BBA2 S1 SEC2" -> "Statistics II": drop programme and section
// codes, then title case words that are not roman numerals.
export function suggestName(key: string): string {
  return key
    .split(/\s+/)
    .filter((w) => !/^(BBA|BIR|BCSAI|BDBA|S\d|SEC\d|GR\d|[A-Z]+\d+)$/i.test(w))
    .map((w) =>
      /^[IVX]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase(),
    )
    .join(" ")
    .slice(0, 200);
}
