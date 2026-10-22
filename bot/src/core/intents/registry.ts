import { help } from "./help";
import type { Intent } from "./types";

// Checked in order; the first match answers. Specific intents go before general ones.
export const INTENTS: readonly Intent[] = [help];
