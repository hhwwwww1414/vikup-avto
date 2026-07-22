"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { log } from "@/lib/logger";

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("forbidden");
  }
  return session;
}

export interface ActionState {
  ok: boolean;
  error?: string;
}

const telegramIdSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{1,15}$/.test(v), {
    message: "Telegram ID должен быть числом",
  });

const createSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(120),
  login: z.string().trim().min(3, "Логин минимум 3 символа").max(120),
  password: z.string().min(6, "Пароль минимум 6 символов").max(200),
  role: z.enum(["ADMIN", "MANAGER"]),
  telegramId: telegramIdSchema,
  isActive: z.boolean(),
});

export async function createManager(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    login: formData.get("login"),
    password: formData.get("password"),
    role: formData.get("role"),
    telegramId: formData.get("telegramId") ?? "",
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
  }
  const d = parsed.data;

  try {
    await prisma.user.create({
      data: {
        name: d.name,
        login: d.login,
        passwordHash: await hashPassword(d.password),
        role: d.role,
        telegramId: d.telegramId ? BigInt(d.telegramId) : null,
        isActive: d.isActive,
      },
    });
  } catch (e) {
    return { ok: false, error: dupMessage(e) };
  }

  log.info("manager.created", { login: d.login });
  revalidatePath("/managers");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Укажите имя").max(120),
  login: z.string().trim().min(3, "Логин минимум 3 символа").max(120),
  password: z.string().max(200).optional(),
  role: z.enum(["ADMIN", "MANAGER"]),
  telegramId: telegramIdSchema,
  isActive: z.boolean(),
});

export async function updateManager(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const rawPassword = String(formData.get("password") ?? "");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    login: formData.get("login"),
    password: rawPassword,
    role: formData.get("role"),
    telegramId: formData.get("telegramId") ?? "",
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
  }
  const d = parsed.data;

  if (rawPassword && rawPassword.length < 6) {
    return { ok: false, error: "Пароль минимум 6 символов" };
  }

  try {
    await prisma.user.update({
      where: { id: d.id },
      data: {
        name: d.name,
        login: d.login,
        role: d.role,
        telegramId: d.telegramId ? BigInt(d.telegramId) : null,
        isActive: d.isActive,
        ...(rawPassword ? { passwordHash: await hashPassword(rawPassword) } : {}),
      },
    });
  } catch (e) {
    return { ok: false, error: dupMessage(e) };
  }

  log.info("manager.updated", { id: d.id });
  revalidatePath("/managers");
  return { ok: true };
}

export async function toggleActive(id: string, next: boolean): Promise<void> {
  await assertAdmin();
  await prisma.user.update({ where: { id }, data: { isActive: next } });
  log.info("manager.toggleActive", { id, next });
  revalidatePath("/managers");
}

function dupMessage(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e);
  if (msg.includes("Unique constraint") || msg.includes("P2002")) {
    if (msg.toLowerCase().includes("telegram")) return "Такой Telegram ID уже используется";
    if (msg.toLowerCase().includes("login")) return "Такой логин уже существует";
    return "Значение должно быть уникальным";
  }
  return "Не удалось сохранить";
}
