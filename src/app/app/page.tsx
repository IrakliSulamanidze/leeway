import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppHome() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const { data: items } = await supabase
    .from("items")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Your items</h1>
      <p className="text-sm text-gray-600">
        Signed in as {String(claims.claims.email ?? "")}
      </p>
      <ul className="mt-4 list-disc pl-5">
        {(items ?? []).map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
      <form action="/api/checkout" method="post" className="mt-6">
        <button className="rounded-md bg-black px-4 py-2 text-white">
          Upgrade
        </button>
      </form>
    </main>
  );
}
