import { describe, expect, it } from "vitest";
import { normalise } from "./normalise";
import { isCrisis, optCommand } from "./safety";

const crisis = (t: string) => isCrisis(normalise(t));

describe("isCrisis", () => {
  it.each([
    "I want to kill myself",
    "honestly i wanna die",
    "thinking about suicide",
    "I've been self-harming again",
    "there's no reason to live",
    "I just want to end it all.",
    "i dont want to be alive",
    "I don\u2019t want to live",
    "i wanna kms",
    "i just want to end it",
    "thinking of taking my own life",
    "me quiero morir",
    "quiero suicidarme",
    "no quiero vivir",
    "a veces pienso en hacerme daño",
  ])("flags %j", (t) => expect(crisis(t)).toBe(true));

  it.each([
    "can i skip micro tmrw",
    "this exam is killing me",
    "I'd die for a day off",
    "dead tired after stats",
    "how many lives do I have left",
    "I'm going to die if I fail this exam",
    "can I end it early and skip the last class",
  ])("leaves %j alone", (t) => expect(crisis(t)).toBe(false));
});

describe("optCommand", () => {
  it("reads STOP and START only as the whole message", () => {
    expect(optCommand(normalise("STOP"))).toBe("stop");
    expect(optCommand(normalise("Start!"))).toBe("start");
    expect(optCommand(normalise("stop reminding me about stats"))).toBeNull();
  });
});
