-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SemesterStatus" AS ENUM ('PLANNED', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'FAILED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'GOOGLE_CLASSROOM');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "GradeType" AS ENUM ('P1', 'P2', 'P3', 'ASSIGNMENT', 'SEMINAR', 'PROJECT', 'PARTICIPATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('MANUAL', 'GOOGLE_CALENDAR');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PDF', 'IMAGE', 'ZIP', 'SLIDE', 'LINK', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentSource" AS ENUM ('UPLOAD', 'LINK', 'GOOGLE_CLASSROOM', 'GOOGLE_DRIVE');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT_DUE', 'ASSIGNMENT_OVERDUE', 'EXAM_UPCOMING', 'GRADE_POSTED', 'STUDY_SESSION', 'SYNC_COMPLETED', 'SYNC_FAILED', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "classroomSyncedAt" TIMESTAMP(3),
    "calendarSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "status" "SemesterStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "googleUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "room" TEXT,
    "credits" INTEGER,
    "passingGrade" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "status" "SubjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "finalGrade" DOUBLE PRECISION,
    "googleCourseId" TEXT,
    "classroomLink" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "semesterId" TEXT,
    "teacherId" TEXT,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMP(3),
    "maxPoints" DOUBLE PRECISION,
    "googleCourseWorkId" TEXT,
    "classroomState" TEXT,
    "classroomLink" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "notes" TEXT,
    "room" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "type" "GradeType" NOT NULL,
    "label" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "maxValue" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "examId" TEXT,
    "assignmentId" TEXT,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "source" "CalendarEventSource" NOT NULL DEFAULT 'MANUAL',
    "googleEventId" TEXT,
    "googleCalendarId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "assignmentId" TEXT,
    "examId" TEXT,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "source" "AttachmentSource" NOT NULL DEFAULT 'UPLOAD',
    "googleDriveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "assignmentId" TEXT,
    "examId" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualMinutes" INTEGER,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "assignmentId" TEXT,
    "examId" TEXT,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "semesters_userId_isCurrent_idx" ON "semesters"("userId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_userId_year_term_key" ON "semesters"("userId", "year", "term");

-- CreateIndex
CREATE INDEX "teachers_userId_idx" ON "teachers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_userId_googleUserId_key" ON "teachers"("userId", "googleUserId");

-- CreateIndex
CREATE INDEX "subjects_userId_semesterId_idx" ON "subjects"("userId", "semesterId");

-- CreateIndex
CREATE INDEX "subjects_userId_status_idx" ON "subjects"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_userId_googleCourseId_key" ON "subjects"("userId", "googleCourseId");

-- CreateIndex
CREATE INDEX "assignments_userId_status_dueDate_idx" ON "assignments"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "assignments_userId_dueDate_idx" ON "assignments"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "assignments_subjectId_idx" ON "assignments"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_userId_googleCourseWorkId_key" ON "assignments"("userId", "googleCourseWorkId");

-- CreateIndex
CREATE INDEX "exams_userId_date_idx" ON "exams"("userId", "date");

-- CreateIndex
CREATE INDEX "exams_subjectId_idx" ON "exams"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "grades_examId_key" ON "grades"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "grades_assignmentId_key" ON "grades"("assignmentId");

-- CreateIndex
CREATE INDEX "grades_userId_subjectId_idx" ON "grades"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "grades_subjectId_type_idx" ON "grades"("subjectId", "type");

-- CreateIndex
CREATE INDEX "calendar_events_userId_startsAt_idx" ON "calendar_events"("userId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_userId_googleEventId_key" ON "calendar_events"("userId", "googleEventId");

-- CreateIndex
CREATE INDEX "attachments_userId_subjectId_idx" ON "attachments"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "attachments_assignmentId_idx" ON "attachments"("assignmentId");

-- CreateIndex
CREATE INDEX "study_sessions_userId_scheduledStart_idx" ON "study_sessions"("userId", "scheduledStart");

-- CreateIndex
CREATE INDEX "study_sessions_userId_status_idx" ON "study_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
