import type { SharedTest, Sharing } from "../ports";

// Sharing for tests and the simulator. Codes always preview as "nothing
// shared" unless a test sets a result.
export class MemorySharing implements Sharing {
  readonly codes: string[] = [];
  shared: SharedTest[] = [];
  preview_: Awaited<ReturnType<Sharing["preview"]>> = {
    outcome: "nothing_shared",
  };
  answers: string[] = [];

  async newCode(_sender: string, code: string) {
    this.codes.push(code);
    return "ok" as const;
  }
  async preview() {
    return this.preview_;
  }
  async answer(
    _sender: string,
    code: string,
    answer: "allow" | "not_now" | "block",
  ) {
    this.answers.push(`${code}:${answer}`);
    return answer;
  }
  async sharedTests() {
    return this.shared;
  }
  async stopSharing() {
    return 1;
  }
  async stopFollowing() {
    return 1;
  }
}
