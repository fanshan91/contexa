-- CreateTable
CREATE TABLE "RuntimeSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sdkIdentity" TEXT,
    "env" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "summaryJson" TEXT,
    CONSTRAINT "RuntimeSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" TEXT,
    CONSTRAINT "RuntimeEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeKeyAggregate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSessionId" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeKeyAggregate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeKeyAggregate_lastSessionId_fkey" FOREIGN KEY ("lastSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RuntimeSession_projectId_status_idx" ON "RuntimeSession"("projectId", "status");

-- CreateIndex
CREATE INDEX "RuntimeSession_projectId_lastSeenAt_idx" ON "RuntimeSession"("projectId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_projectId_occurredAt_idx" ON "RuntimeEvent"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_projectId_route_occurredAt_idx" ON "RuntimeEvent"("projectId", "route", "occurredAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_projectId_key_occurredAt_idx" ON "RuntimeEvent"("projectId", "key", "occurredAt");

-- CreateIndex
CREATE INDEX "RuntimeKeyAggregate_projectId_lastSeenAt_idx" ON "RuntimeKeyAggregate"("projectId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RuntimeKeyAggregate_projectId_route_lastSeenAt_idx" ON "RuntimeKeyAggregate"("projectId", "route", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeKeyAggregate_projectId_route_key_key" ON "RuntimeKeyAggregate"("projectId", "route", "key");
