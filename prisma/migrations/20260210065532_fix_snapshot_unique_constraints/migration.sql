/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,date,platform]` on the table `ChannelPerformanceSnapshot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,date]` on the table `ExecutiveSnapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChannelPerformanceSnapshot_workspaceId_date_platform_idx";

-- DropIndex
DROP INDEX "ExecutiveSnapshot_workspaceId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ChannelPerformanceSnapshot_workspaceId_date_platform_key" ON "ChannelPerformanceSnapshot"("workspaceId", "date", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveSnapshot_workspaceId_date_key" ON "ExecutiveSnapshot"("workspaceId", "date");
