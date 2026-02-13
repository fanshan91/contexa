-- CreateTable
CREATE TABLE "RuntimeCaptureSessionV2" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sdkIdentity" TEXT NOT NULL,
    "env" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "closeReason" TEXT,
    "summaryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeCaptureSessionV2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeCaptureBatchV2" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "sdkIdentity" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuntimeCaptureBatchV2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeCaptureBatchV2_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeCaptureSessionV2" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeCaptureItemV2" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastSourceText" TEXT NOT NULL,
    "sourceTextHash" TEXT NOT NULL,
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeCaptureItemV2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeCaptureItemV2_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeCaptureSessionV2" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeCaptureRouteStatV2" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "route" TEXT NOT NULL,
    "keysTotal" INTEGER NOT NULL DEFAULT 0,
    "newKeysCount" INTEGER NOT NULL DEFAULT 0,
    "textChangedCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeCaptureRouteStatV2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeCaptureRouteStatV2_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeCaptureSessionV2" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeCaptureApplyRunV2" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "summaryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeCaptureApplyRunV2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeCaptureApplyRunV2_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeCaptureSessionV2" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RuntimeCaptureSessionV2_projectId_status_idx" ON "RuntimeCaptureSessionV2"("projectId", "status");

-- CreateIndex
CREATE INDEX "RuntimeCaptureSessionV2_projectId_lastSeenAt_idx" ON "RuntimeCaptureSessionV2"("projectId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RuntimeCaptureSessionV2_projectId_startedAt_idx" ON "RuntimeCaptureSessionV2"("projectId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeCaptureBatchV2_projectId_sessionId_batchId_sdkIdentity_key" ON "RuntimeCaptureBatchV2"("projectId", "sessionId", "batchId", "sdkIdentity");

-- CreateIndex
CREATE INDEX "RuntimeCaptureBatchV2_projectId_createdAt_idx" ON "RuntimeCaptureBatchV2"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RuntimeCaptureBatchV2_sessionId_createdAt_idx" ON "RuntimeCaptureBatchV2"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeCaptureItemV2_sessionId_route_key_key" ON "RuntimeCaptureItemV2"("sessionId", "route", "key");

-- CreateIndex
CREATE INDEX "RuntimeCaptureItemV2_projectId_sessionId_idx" ON "RuntimeCaptureItemV2"("projectId", "sessionId");

-- CreateIndex
CREATE INDEX "RuntimeCaptureItemV2_projectId_route_lastSeenAt_idx" ON "RuntimeCaptureItemV2"("projectId", "route", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RuntimeCaptureItemV2_sessionId_lastSeenAt_idx" ON "RuntimeCaptureItemV2"("sessionId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeCaptureRouteStatV2_sessionId_route_key" ON "RuntimeCaptureRouteStatV2"("sessionId", "route");

-- CreateIndex
CREATE INDEX "RuntimeCaptureRouteStatV2_projectId_sessionId_idx" ON "RuntimeCaptureRouteStatV2"("projectId", "sessionId");

-- CreateIndex
CREATE INDEX "RuntimeCaptureRouteStatV2_projectId_lastSeenAt_idx" ON "RuntimeCaptureRouteStatV2"("projectId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RuntimeCaptureApplyRunV2_projectId_createdAt_idx" ON "RuntimeCaptureApplyRunV2"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RuntimeCaptureApplyRunV2_sessionId_createdAt_idx" ON "RuntimeCaptureApplyRunV2"("sessionId", "createdAt");
