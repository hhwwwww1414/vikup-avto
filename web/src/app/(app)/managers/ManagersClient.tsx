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
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function ManagerFormFields({ row }: { row?: ManagerRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label="Имя">
        <input name="name" defaultValue={row?.name} required className={inputCls} />
      </Field>
      <Field label="Логин / Email">
        <input name="login" defaultValue={row?.login} required className={inputCls} />
      </Field>
      <Field label={row ? "Новый пароль (необязательно)" : "Пароль"}>
        <input
          name="password"
          type="password"
          required={!row}
          autoComplete="new-password"
          className={inputCls}
        />
      </Field>
      <Field label="Telegram ID">
        <input
          name="telegramId"
          defaultValue={row?.telegramId ?? ""}
          inputMode="numeric"
          placeholder="напр. 123456789"
          className={inputCls}
        />
      </Field>
      <Field label="Роль">
        <select name="role" defaultValue={row?.role ?? "MANAGER"} className={inputCls}>
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 pt-6 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={row ? row.isActive : true}
          className="h-4 w-4"
        />
        Активен
      </label>
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
    <form action={action} className="space-y-4">
      <ManagerFormFields />
      {state.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
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
    <form action={action} className="space-y-4">
      <ManagerFormFields row={row} />
      {state.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 mt-10 w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + Создать менеджера
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Telegram ID</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Авто</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.login}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{r.telegramId ?? "—"}</td>
                <td className="px-4 py-3">{r.role}</td>
                <td className="px-4 py-3">{r.vehicles}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.isActive ? "Активен" : "Заблокирован"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/5"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => onToggle(r)}
                      disabled={busyId === r.id}
                      className={`rounded-lg px-3 py-1.5 text-xs disabled:opacity-50 ${
                        r.isActive
                          ? "text-red-600 hover:bg-red-50"
                          : "text-green-700 hover:bg-green-50"
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
