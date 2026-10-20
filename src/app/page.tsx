import Link from "next/link";
import { WaitlistForm } from "./waitlist-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">App name</h1>
      <p className="text-lg text-gray-600">
        One sentence on who this is for and what it does.
      </p>
      <WaitlistForm />
      <Link href="/login" className="text-sm underline">
        Log in
      </Link>
    </main>
  );
}
