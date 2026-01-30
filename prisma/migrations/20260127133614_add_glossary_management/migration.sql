-- AlterTable
ALTER TABLE "Module" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "ProjectGlossaryTerm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'recommended',
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "note" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectGlossaryTerm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectGlossaryTerm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectGlossaryTerm_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectNegativePrompt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "alternative" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectNegativePrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectNegativePrompt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectNegativePrompt_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectGlossaryTerm_projectId_locale_idx" ON "ProjectGlossaryTerm"("projectId", "locale");

-- CreateIndex
CREATE INDEX "ProjectGlossaryTerm_projectId_locale_status_idx" ON "ProjectGlossaryTerm"("projectId", "locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGlossaryTerm_projectId_locale_source_key" ON "ProjectGlossaryTerm"("projectId", "locale", "source");

-- CreateIndex
CREATE INDEX "ProjectNegativePrompt_projectId_locale_idx" ON "ProjectNegativePrompt"("projectId", "locale");

-- CreateIndex
CREATE INDEX "ProjectNegativePrompt_projectId_locale_status_idx" ON "ProjectNegativePrompt"("projectId", "locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectNegativePrompt_projectId_locale_phrase_key" ON "ProjectNegativePrompt"("projectId", "locale", "phrase");
