"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueIntelligenceJob } from "@/lib/intelligence/run";

export async function rerunIntelligence(vehicleId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") return;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true },
  });
  if (!vehicle) return;

  await enqueueIntelligenceJob(vehicle.id);
  revalidatePath(`/garage/${vehicle.id}`);
  revalidatePath("/intelligence/experiments");
}
