-- CreateTable
CREATE TABLE "RuntimeSessionKeyAggregate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeSessionKeyAggregate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeSessionKeyAggregate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeSessionDraftOp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetPageId" INTEGER,
    "targetModuleId" INTEGER,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeSessionDraftOp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeSessionDraftOp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeSessionDraftOp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RuntimeSessionKeyAggregate_projectId_sessionId_idx" ON "RuntimeSessionKeyAggregate"("projectId", "sessionId");

-- CreateIndex
CREATE INDEX "RuntimeSessionKeyAggregate_projectId_route_lastSeenAt_idx" ON "RuntimeSessionKeyAggregate"("projectId", "route", "lastSeenAt");

-- CreateIndex
CREATE INDEX "RuntimeSessionKeyAggregate_projectId_lastSeenAt_idx" ON "RuntimeSessionKeyAggregate"("projectId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeSessionKeyAggregate_sessionId_route_key_key" ON "RuntimeSessionKeyAggregate"("sessionId", "route", "key");

-- CreateIndex
CREATE INDEX "RuntimeSessionDraftOp_projectId_sessionId_idx" ON "RuntimeSessionDraftOp"("projectId", "sessionId");

-- CreateIndex
CREATE INDEX "RuntimeSessionDraftOp_projectId_updatedAt_idx" ON "RuntimeSessionDraftOp"("projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeSessionDraftOp_sessionId_route_key_key" ON "RuntimeSessionDraftOp"("sessionId", "route", "key");
