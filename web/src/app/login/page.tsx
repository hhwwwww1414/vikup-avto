import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/garage");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-4xl font-black tracking-tight text-[var(--text)]">VIKUP</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Внутренний доступ к гаражу и аналитике выкупных автомобилей.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-6 shadow-card">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
