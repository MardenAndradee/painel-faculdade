-- CreateEnum
CREATE TYPE "ClassPostKind" AS ENUM ('ASSIGNMENT', 'EXAM', 'EVENT');

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "classPostId" TEXT;

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "classPostId" TEXT;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "classPostId" TEXT;

-- CreateTable
CREATE TABLE "class_posts" (
    "id" TEXT NOT NULL,
    "kind" "ClassPostKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "room" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "Priority",
    "maxPoints" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "classId" TEXT NOT NULL,
    "classSubjectId" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "class_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_post_copies" (
    "id" TEXT NOT NULL,
    "detachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "examId" TEXT,
    "calendarEventId" TEXT,

    CONSTRAINT "class_post_copies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_posts_classId_idx" ON "class_posts"("classId");

-- CreateIndex
CREATE INDEX "class_posts_classSubjectId_idx" ON "class_posts"("classSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "class_post_copies_assignmentId_key" ON "class_post_copies"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "class_post_copies_examId_key" ON "class_post_copies"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "class_post_copies_calendarEventId_key" ON "class_post_copies"("calendarEventId");

-- CreateIndex
CREATE UNIQUE INDEX "class_post_copies_classPostId_userId_key" ON "class_post_copies"("classPostId", "userId");

-- CreateIndex
CREATE INDEX "assignments_classPostId_idx" ON "assignments"("classPostId");

-- CreateIndex
CREATE INDEX "calendar_events_classPostId_idx" ON "calendar_events"("classPostId");

-- CreateIndex
CREATE INDEX "exams_classPostId_idx" ON "exams"("classPostId");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_classPostId_fkey" FOREIGN KEY ("classPostId") REFERENCES "class_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_classPostId_fkey" FOREIGN KEY ("classPostId") REFERENCES "class_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_classPostId_fkey" FOREIGN KEY ("classPostId") REFERENCES "class_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_posts" ADD CONSTRAINT "class_posts_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_posts" ADD CONSTRAINT "class_posts_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "class_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_posts" ADD CONSTRAINT "class_posts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_post_copies" ADD CONSTRAINT "class_post_copies_classPostId_fkey" FOREIGN KEY ("classPostId") REFERENCES "class_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_post_copies" ADD CONSTRAINT "class_post_copies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_post_copies" ADD CONSTRAINT "class_post_copies_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_post_copies" ADD CONSTRAINT "class_post_copies_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_post_copies" ADD CONSTRAINT "class_post_copies_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
