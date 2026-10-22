import { help } from "./help";
import { lives } from "./lives";
import { skipped } from "./skipped";
import { tests } from "./tests";
import { week } from "./week";
import type { Intent } from "./types";

// Checked in order; the first match answers. Specific intents go before general ones.
export const INTENTS: readonly Intent[] = [help, lives, week, tests, skipped];
