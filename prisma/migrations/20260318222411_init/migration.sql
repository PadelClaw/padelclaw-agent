-- CreateTable
CREATE TABLE "MessageLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "durationMs" INTEGER,
    "toolCalls" TEXT
);

-- CreateTable
CREATE TABLE "TrainerConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "priceSingle" INTEGER NOT NULL,
    "pricePackage5" INTEGER NOT NULL,
    "pricePackage10" INTEGER NOT NULL,
    "availabilityJson" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerName" TEXT NOT NULL,
    "playerPhone" TEXT NOT NULL,
    "slotStart" TEXT NOT NULL,
    "slotEnd" TEXT NOT NULL,
    "calendarEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed'
);

-- CreateIndex
CREATE INDEX "MessageLog_from_idx" ON "MessageLog"("from");

-- CreateIndex
CREATE INDEX "Booking_playerPhone_idx" ON "Booking"("playerPhone");
