-- CreateTable
CREATE TABLE "LanguagePackTemplateItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LanguagePackTemplateItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LanguagePackTemplateItem_projectId_position_idx" ON "LanguagePackTemplateItem"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LanguagePackTemplateItem_projectId_signature_key" ON "LanguagePackTemplateItem"("projectId", "signature");
