import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/garage");

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent)] text-sm font-extrabold text-white">
            V
          </div>
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-[var(--text)]">VIKUP</div>
            <div className="text-sm font-medium text-[var(--muted)]">Вход в систему</div>
          </div>
        </div>
        <div className="dashboard-panel p-6">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
