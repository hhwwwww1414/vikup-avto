-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MANAGER',
    "telegram_id" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "photo_key" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "license_plate_normalized" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "telegram_message_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "vehicles_license_plate_normalized_idx" ON "vehicles"("license_plate_normalized");

-- CreateIndex
CREATE INDEX "vehicles_created_at_idx" ON "vehicles"("created_at");

-- CreateIndex
CREATE INDEX "vehicles_manager_id_idx" ON "vehicles"("manager_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
