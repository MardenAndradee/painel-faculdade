-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CLASS_ANNOUNCEMENT';

-- CreateTable
CREATE TABLE "class_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "classId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "class_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "classId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "class_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_announcements_classId_pinned_createdAt_idx" ON "class_announcements"("classId", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "class_notes_classId_idx" ON "class_notes"("classId");

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_notes" ADD CONSTRAINT "class_notes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_notes" ADD CONSTRAINT "class_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
