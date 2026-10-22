export type Voice = "straight" | "friendly" | "roast";

// The moments a voice may add a line to. The facts after it never change.
// Off-topic and not-understood replies get no voice: the reader cannot tell a
// silly message from a sad one, and a joke must never land on the second.
export type Situation =
  | "lives_ok"
  | "lives_tight"
  | "skip_saved"
  | "skip_saved_tight"
  | "skip_ask"
  | "skip_already"
  | "week_safe"
  | "week_risky"
  | "tests_some"
  | "tests_none";

export type Line = {
  text: string;
  // Only approved lines are ever sent. Irakli approves every funny line.
  approved: boolean;
  // Mild swearing: never sent to a student who is under 18 or did not say.
  swears?: boolean;
};

export type Library = Record<
  Exclude<Voice, "straight">,
  Record<Situation, Line[]>
>;
