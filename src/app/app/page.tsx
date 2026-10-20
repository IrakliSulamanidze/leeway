import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";
import { MAX_ITEM_LENGTH } from "@/lib/config";
import { CalendarHome } from "@/components/calendar-home";
import { addItem } from "./actions";

export const metadata = { title: "Your courses" };

// Placeholder for the core feature: later PRs replace the generic item list.
export default async function AppHome() {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const { data: items } = await supabase
    .from("items")
    .select("id, title")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <h1 className="text-[28px] font-bold">Your courses</h1>
      <form action={addItem} className="mt-5 flex gap-2">
        <label htmlFor="core-input" className="sr-only">
          Course name
        </label>
        <input
          id="core-input"
          name="title"
          type="text"
          required
          maxLength={MAX_ITEM_LENGTH}
          placeholder="Course name"
          data-testid="core-input"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-input bg-surface px-3 text-[17px]"
        />
        <button
          type="submit"
          data-testid="core-submit"
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary"
        >
          Add
        </button>
      </form>
      <ul className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
        {(items ?? []).map((item) => (
          <li key={item.id} data-testid="core-item" className="px-4 py-3">
            {item.title}
          </li>
        ))}
      </ul>
      <CalendarHome />
    </main>
  );
}
