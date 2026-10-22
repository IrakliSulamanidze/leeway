import type { Reader, Reading } from "../ports";

// A reader that answers from a fixed table, for tests and the simulator when
// no API key is set. Unknown text reads as unavailable.
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
