// The fixed format one syllabus read returns (tech-plan 5.3, spike S2), as zod for
// validation and as Gemini's responseSchema so the model can only answer in it.
import { z } from "zod";

export const ASSESSMENT_KINDS = [
  "test",
  "exam",
  "presentation",
  "project",
  "participation",
  "other",
] as const;
export const SESSION_KINDS = [
  "class",
  "lab",
  "test",
  "exam",
  "presentation",
  "other",
] as const;
export const MAX_SESSIONS = 80;
export const TEXT_MIN = 200;
export const TEXT_MAX = 60_000;

const sessionNumber = z.number().int().min(1).max(MAX_SESSIONS);
const quote = z.string().max(2000);

export const syllabusReadSchema = z
  .object({
    course_name: z.string().max(300),
    sessions_total: sessionNumber.nullable(),
    sessions_total_quote: quote.nullable(),
    attendance_penalty: quote.nullable(),
    assessments: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          kind: z.enum(ASSESSMENT_KINDS),
          sessions: z.array(sessionNumber).max(MAX_SESSIONS),
          weight_percent: z.number().gt(0).max(100).nullable(),
          weight_is_assumed_split: z.boolean(),
          // The sessions are alternatives: each group uses one of them.
          depends_on_group: z.boolean(),
          // Coursework spread over the term (individual or group work), not
          // a test on one day: a weight only.
          continuous: z.boolean().default(false),
          quote,
        }),
      )
      .max(60),
    sessions: z
      .array(
        z.object({
          number: sessionNumber,
          title: z.string().min(1).max(500),
          kind: z.enum(SESSION_KINDS),
          pre_reading: z.string().max(2000).nullable(),
          // True when the syllabus implies this rather than saying it outright.
          inferred: z.boolean(),
        }),
      )
      .max(MAX_SESSIONS),
    retake_rule_general: quote.nullable(),
    retake_rule_stated_here: z.boolean(),
    conflicts: z.array(z.string().max(500)).max(20),
  })
  .superRefine((d, ctx) => {
    const limit = d.sessions_total ?? MAX_SESSIONS;
    const nums = d.sessions.map((s) => s.number);
    if (new Set(nums).size !== nums.length)
      ctx.addIssue({ code: "custom", message: "duplicate session numbers" });
    if (nums.some((n) => n > limit))
      ctx.addIssue({ code: "custom", message: "session number out of range" });
    for (const a of d.assessments)
      if (a.sessions.some((n) => n > limit))
        ctx.addIssue({ code: "custom", message: "assessment out of range" });
  });

export type SyllabusRead = z.infer<typeof syllabusReadSchema>;

const nullable = <T extends object>(t: T) => ({ ...t, nullable: true });
const STRING = { type: "STRING" };
const INTEGER = { type: "INTEGER" };
const BOOLEAN = { type: "BOOLEAN" };

export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    course_name: STRING,
    sessions_total: nullable(INTEGER),
    sessions_total_quote: nullable(STRING),
    attendance_penalty: nullable(STRING),
    assessments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: STRING,
          kind: { type: "STRING", enum: [...ASSESSMENT_KINDS] },
          sessions: { type: "ARRAY", items: INTEGER },
          weight_percent: nullable({ type: "NUMBER" }),
          weight_is_assumed_split: BOOLEAN,
          depends_on_group: BOOLEAN,
          continuous: BOOLEAN,
          quote: STRING,
        },
        required: [
          "name",
          "kind",
          "sessions",
          "weight_percent",
          "weight_is_assumed_split",
          "depends_on_group",
          "continuous",
          "quote",
        ],
      },
    },
    sessions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          number: INTEGER,
          title: STRING,
          kind: { type: "STRING", enum: [...SESSION_KINDS] },
          pre_reading: nullable(STRING),
          inferred: BOOLEAN,
        },
        required: ["number", "title", "kind", "pre_reading", "inferred"],
      },
    },
    retake_rule_general: nullable(STRING),
    retake_rule_stated_here: BOOLEAN,
    conflicts: { type: "ARRAY", items: STRING },
  },
  required: [
    "course_name",
    "sessions_total",
    "sessions_total_quote",
    "attendance_penalty",
    "assessments",
    "sessions",
    "retake_rule_general",
    "retake_rule_stated_here",
    "conflicts",
  ],
};

export const readRequestSchema = z.object({
  courseId: z.uuid(),
  text: z.string().trim().min(TEXT_MIN).max(TEXT_MAX),
});
