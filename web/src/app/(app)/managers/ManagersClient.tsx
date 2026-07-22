"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createManager,
  updateManager,
  toggleActive,
  type ActionState,
} from "./actions";

export interface ManagerRow {
  id: string;
  name: string;
  login: string;
  role: "ADMIN" | "MANAGER";
  telegramId: string | null;
  isActive: boolean;
  vehicles: number;
}

const initialState: ActionState = { ok: false };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--sidebar)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sidebar-soft)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Сохранение..." : label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";

function ManagerFormFields({ row }: { row?: ManagerRow }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label="Имя">
        <input name="name" defaultValue={row?.name} required className={inputCls} />
      </Field>
      <Field label="Логин / Email">
        <input name="login" defaultValue={row?.login} required className={inputCls} />
      </Field>
      <Field label={row ? "Новый пароль" : "Пароль"}>
        <input
          name="password"
          type="password"
          required={!row}
          autoComplete="new-password"
          placeholder={row ? "Оставьте пустым, чтобы не менять" : undefined}
          className={inputCls}
        />
      </Field>
      <Field label="Telegram ID">
        <input
          name="telegramId"
          defaultValue={row?.telegramId ?? ""}
          inputMode="numeric"
          placeholder="123456789"
          className={inputCls}
        />
      </Field>
      <Field label="Роль">
        <select name="role" defaultValue={row?.role ?? "MANAGER"} className={inputCls}>
          <option value="MANAGER">Менеджер</option>
          <option value="ADMIN">Админ</option>
        </select>
      </Field>
      <label className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm font-semibold">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={row ? row.isActive : true}
          className="h-4 w-4 accent-blue-600"
        />
        Активен
      </label>
    </div>
  );
}

function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {error}
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useFormState(
    async (prev: ActionState, fd: FormData) => {
      const r = await createManager(prev, fd);
      if (r.ok) onDone();
      return r;
    },
    initialState,
  );
  return (
    <form action={action} className="space-y-5">
      <ManagerFormFields />
      <FormError error={state.error} />
      <SubmitButton label="Создать менеджера" />
    </form>
  );
}

function EditForm({ row, onDone }: { row: ManagerRow; onDone: () => void }) {
  const [state, action] = useFormState(
    async (prev: ActionState, fd: FormData) => {
      const r = await updateManager(prev, fd);
      if (r.ok) onDone();
      return r;
    },
    initialState,
  );
  return (
    <form action={action} className="space-y-5">
      <ManagerFormFields row={row} />
      <FormError error={state.error} />
      <SubmitButton label="Сохранить" />
    </form>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 mt-10 w-full max-w-2xl rounded-lg border border-[var(--border)] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] transition hover:bg-slate-100 hover:text-[var(--text)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ManagersClient({ rows }: { rows: ManagerRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagerRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onToggle(row: ManagerRow) {
    setBusyId(row.id);
    try {
      await toggleActive(row.id, !row.isActive);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--muted)]">
          Пользователей: <span className="text-[var(--text)] tabular-nums">{rows.length}</span>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--sidebar)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sidebar-soft)] focus:outline-none focus:ring-4 focus:ring-accent/15"
        >
          Создать менеджера
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[var(--panel-strong)]">
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-4 py-3 font-bold">Имя</th>
                <th className="px-4 py-3 font-bold">Логин</th>
                <th className="px-4 py-3 font-bold">Telegram ID</th>
                <th className="px-4 py-3 font-bold">Роль</th>
                <th className="px-4 py-3 font-bold">Авто</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.login}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.telegramId ?? "-"}</td>
                  <td className="px-4 py-3">{r.role === "ADMIN" ? "Админ" : "Менеджер"}</td>
                  <td className="px-4 py-3 tabular-nums">{r.vehicles}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-[0.06em] ${
                        r.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.isActive ? "Активен" : "Заблокирован"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(r)}
                        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => onToggle(r)}
                        disabled={busyId === r.id}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          r.isActive
                            ? "text-red-600 hover:bg-red-50"
                            : "text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {r.isActive ? "Заблокировать" : "Активировать"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {creating && (
        <Modal title="Новый менеджер" onClose={() => setCreating(false)}>
          <CreateForm onDone={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Изменить: ${editing.name}`} onClose={() => setEditing(null)}>
          <EditForm row={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
