-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_otp_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "pending_verifications" (
    "id" TEXT NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "otp_expires_at" TIMESTAMPTZ NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pending_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_verifications_mobile_key" ON "pending_verifications"("mobile");

-- CreateIndex
CREATE INDEX "pending_verifications_mobile_idx" ON "pending_verifications"("mobile");
