import { LINES } from "../lines";
import type { Intent } from "./types";

const WORDS = new Set(["help", "menu", "hi", "hello", "hey", "start"]);

// The three answers students ask for most, as buttons.
export const MENU = [
  { id: "lives", title: "My lives" },
  { id: "week", title: "This week" },
  { id: "tests", title: "My tests" },
];

export const help: Intent = {
  name: "help",
  matches: (turn) =>
    turn.button === "help" || (turn.text !== null && WORDS.has(turn.text)),
  run: () => ({
    replies: [
      {
        text: LINES.help,
        buttons: MENU,
      },
    ],
  }),
};
