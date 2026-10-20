import { AlertsSetting } from "@/components/alerts-setting";
import { CalendarRow } from "@/components/calendar-row";
import { DeleteAccount } from "@/components/delete-account";
import { getSignedInEmail } from "@/lib/supabase/session";

export const metadata = { title: "Settings" };

// Each lane adds its own row (alerts, calendar, syllabi).
export default async function SettingsPage() {
  const email = await getSignedInEmail();
  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-[18px] px-5 py-6">
      <h1 className="m-0 text-[28px] font-bold">Settings</h1>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        <li className="px-4 py-3">
          Account
          <span className="block text-[13.5px] text-muted [overflow-wrap:anywhere]">
            {email}
          </span>
        </li>
      </ul>
      <CalendarRow />
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        <li className="px-4 py-3.5">
          <AlertsSetting />
        </li>
      </ul>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        <li className="px-4 py-3.5">
          <DeleteAccount />
        </li>
      </ul>
    </main>
  );
}
