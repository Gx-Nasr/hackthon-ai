-- Add profile fields without recreating or deleting existing users/sessions.
ALTER TABLE "User" ADD COLUMN "studentId" TEXT;
ALTER TABLE "User" ADD COLUMN "homeCampus" TEXT;
ALTER TABLE "User" ADD COLUMN "school" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" DATETIME;

-- Give all existing accounts a unique ID before adding the unique index.
UPDATE "User" SET "studentId" = 'UR-' || upper(hex(randomblob(8))) WHERE "studentId" IS NULL;
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

CREATE TABLE "StudentInterest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentInterest_userId_value_key" ON "StudentInterest"("userId", "value");
CREATE INDEX "StudentInterest_userId_idx" ON "StudentInterest"("userId");

CREATE TABLE "UnavailableTimeBlock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL CHECK ("dayOfWeek" >= 1 AND "dayOfWeek" <= 7),
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "activityName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnavailableTimeBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UnavailableTimeBlock_userId_dayOfWeek_startTime_idx" ON "UnavailableTimeBlock"("userId", "dayOfWeek", "startTime");
