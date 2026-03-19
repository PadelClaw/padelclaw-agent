-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainerConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "name" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "trainerPhone" TEXT,
    "location" TEXT NOT NULL,
    "priceSingle" INTEGER NOT NULL,
    "pricePackage5" INTEGER NOT NULL,
    "pricePackage10" INTEGER NOT NULL,
    "availabilityJson" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TrainerConfig" ("availabilityJson", "calendarId", "clubName", "id", "language", "location", "name", "pricePackage10", "pricePackage5", "priceSingle", "trainerPhone", "updatedAt") SELECT "availabilityJson", "calendarId", "clubName", "id", "language", "location", "name", "pricePackage10", "pricePackage5", "priceSingle", "trainerPhone", "updatedAt" FROM "TrainerConfig";
DROP TABLE "TrainerConfig";
ALTER TABLE "new_TrainerConfig" RENAME TO "TrainerConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
