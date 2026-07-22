import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/garage");

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-graphite">VIKUP</div>
          <p className="mt-1 text-sm text-[var(--muted)]">Вход в систему</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-card">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
