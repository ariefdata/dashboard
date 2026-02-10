/*
  Warnings:

  - You are about to drop the `Snapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Snapshot";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ExecutiveSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "revenue" DECIMAL NOT NULL DEFAULT 0,
    "spend" DECIMAL NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "roas" DECIMAL,
    "confidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelPerformanceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "platform" TEXT NOT NULL,
    "revenue" DECIMAL NOT NULL DEFAULT 0,
    "spend" DECIMAL NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "roas" DECIMAL,
    "cvr" DECIMAL,
    "ctr" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelPerformanceSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExecutiveSnapshot_workspaceId_date_idx" ON "ExecutiveSnapshot"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "ChannelPerformanceSnapshot_workspaceId_date_platform_idx" ON "ChannelPerformanceSnapshot"("workspaceId", "date", "platform");
