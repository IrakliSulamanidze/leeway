import type { Speech, Transcript } from "../ports";

// Voice notes for tests and the simulator: each media id maps to a result.
export class ScriptedSpeech implements Speech {
  private readonly table: Record<string, Transcript>;

  constructor(table: Record<string, Transcript> = {}) {
    this.table = table;
  }

  async transcribe(mediaId: string): Promise<Transcript> {
    return this.table[mediaId] ?? { ok: false, reason: "off" };
  }
}
