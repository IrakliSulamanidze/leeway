import type { Reader, Reading } from "../ports";

// A reader that answers from a fixed table: for tests, and wherever no API key
// is set (then the table is empty and free text gets the menu).
export class ScriptedReader implements Reader {
  readonly calls: string[] = [];
  private readonly table: Record<string, Reading>;

  constructor(table: Record<string, Reading> = {}) {
    this.table = table;
  }

  async read(text: string) {
    this.calls.push(text);
    return this.table[text] ?? null;
  }
}
