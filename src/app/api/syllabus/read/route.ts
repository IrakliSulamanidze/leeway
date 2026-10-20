// POST /api/syllabus/read {courseId, text}: one AI read, nothing written
// (tech-plan 5.3). The review screen confirms and saves through a server action.
import { NextResponse } from "next/server";
import { readSyllabus, syllabusReadEnabled } from "@/lib/server/gemini";
import { READ_BUSY, READ_INVALID } from "@/lib/syllabus/copy";
import { readRequestSchema } from "@/lib/syllabus/schema";
import { createClient } from "@/lib/supabase/server";

// One read took 95.5 s in spike S2; the Gemini chain itself stops at 240 s.
export const maxDuration = 300;

const error = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!syllabusReadEnabled()) return error(404, "Not found");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error(401, "Log in first.");

  const parsed = readRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return error(400, "Send a course and 200 to 60,000 characters of text.");
  const { courseId, text } = parsed.data;

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return error(404, "Not found");

  const { data: reserved, error: rpcError } =
    await supabase.rpc("reserve_ai_call");
  if (rpcError || reserved !== true) return error(429, READ_BUSY);

  const result = await readSyllabus(text);
  if (result.ok) return NextResponse.json({ read: result.read });
  return result.reason === "invalid"
    ? error(422, READ_INVALID)
    : error(503, READ_BUSY);
}
