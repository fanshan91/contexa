-- CreateTable
CREATE TABLE "ProjectRuntimeToken" (
    "projectId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenEnc" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectRuntimeToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
