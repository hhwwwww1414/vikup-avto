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
const inputCls = "dashboard-input w-full px-3.5 py-2.5 text-sm font-medium";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="dashboard-button px-4 py-2.5 text-sm disabled:opacity-60">
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
      <span className="mb-1.5 block text-xs font-bold text-[var(--muted-strong)]">{label}</span>
      {children}
    </label>
  );
}

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
          placeholder={row ? "Не менять" : undefined}
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
      <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-2.5 text-sm font-bold text-[var(--text)]">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={row ? row.isActive : true}
          className="h-4 w-4 rounded border-[var(--border-strong)] accent-blue-600"
        />
        Активен
      </label>
    </div>
  );
}

function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
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
      <SubmitButton label="Создать" />
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
      <div className="absolute inset-0 bg-slate-950/35" onClick={onClose} />
      <div className="dashboard-panel relative z-50 mt-10 w-full max-w-2xl p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="dashboard-panel p-5">
          <div className="text-xs font-bold text-[var(--muted)]">Всего</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">{rows.length}</div>
        </section>
        <section className="dashboard-panel p-5">
          <div className="text-xs font-bold text-[var(--muted)]">Активные</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">
            {rows.filter((r) => r.isActive).length}
          </div>
        </section>
        <section className="dashboard-panel p-5">
          <div className="text-xs font-bold text-[var(--muted)]">Админы</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">
            {rows.filter((r) => r.role === "ADMIN").length}
          </div>
        </section>
        <section className="dashboard-panel flex items-center justify-between gap-4 p-5">
          <div>
            <div className="text-xs font-bold text-[var(--muted)]">Доступ</div>
            <div className="mt-2 text-sm font-semibold text-[var(--text)]">Команда</div>
          </div>
          <button onClick={() => setCreating(true)} className="dashboard-button px-4 py-2.5 text-sm">
            Создать
          </button>
        </section>
      </div>

      <section className="dashboard-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr className="text-left">
                <th className="px-5 py-3 font-bold">Имя</th>
                <th className="px-5 py-3 font-bold">Логин</th>
                <th className="px-5 py-3 font-bold">Telegram</th>
                <th className="px-5 py-3 font-bold">Роль</th>
                <th className="px-5 py-3 font-bold">Авто</th>
                <th className="px-5 py-3 font-bold">Статус</th>
                <th className="px-5 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-5 py-4 font-bold text-[var(--text)]">{r.name}</td>
                  <td className="px-5 py-4 font-medium text-[var(--muted-strong)]">{r.login}</td>
                  <td className="px-5 py-4 font-medium text-[var(--muted-strong)]">{r.telegramId ?? "-"}</td>
                  <td className="px-5 py-4 font-medium text-[var(--text)]">{r.role === "ADMIN" ? "Админ" : "Менеджер"}</td>
                  <td className="px-5 py-4 font-semibold tabular-nums text-[var(--text)]">{r.vehicles}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                        r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.isActive ? "Активен" : "Блок"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(r)}
                        className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)]"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => onToggle(r)}
                        disabled={busyId === r.id}
                        className="rounded-xl bg-[var(--text)] px-3 py-2 text-xs font-bold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
                      >
                        {r.isActive ? "Блок" : "Активировать"}
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
        <Modal title={editing.name} onClose={() => setEditing(null)}>
          <EditForm row={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
