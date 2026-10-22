import { LINES } from "../lines";
import type { Intent } from "./types";

const WORDS = new Set(["help", "menu", "hi", "hello", "hey", "start"]);

export const help: Intent = {
  name: "help",
  matches: (turn) =>
    turn.button === "help" || (turn.text !== null && WORDS.has(turn.text)),
  run: () => [{ text: LINES.help }],
};
