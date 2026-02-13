-- CreateTable
CREATE TABLE "RuntimeCaptureGate" (
    "projectId" INTEGER NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "sessionId" INTEGER,
    "openedByUserId" INTEGER,
    "openedAt" DATETIME,
    "userLastSeenAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeCaptureGate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuntimeCaptureGate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RuntimeSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RuntimeCaptureGate_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RuntimeCaptureGate_status_idx" ON "RuntimeCaptureGate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeCaptureGate_sessionId_key" ON "RuntimeCaptureGate"("sessionId");

-- CreateIndex
CREATE INDEX "RuntimeCaptureGate_userLastSeenAt_idx" ON "RuntimeCaptureGate"("userLastSeenAt");
