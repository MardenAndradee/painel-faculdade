-- CreateTable
CREATE TABLE "decks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,

    CONSTRAINT "decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "hint" TEXT,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_reviews" (
    "id" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,

    CONSTRAINT "flashcard_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decks_userId_subjectId_idx" ON "decks"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "decks_userId_archivedAt_idx" ON "decks"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "flashcards_userId_dueDate_idx" ON "flashcards"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "flashcards_deckId_dueDate_idx" ON "flashcards"("deckId", "dueDate");

-- CreateIndex
CREATE INDEX "flashcard_reviews_userId_reviewedAt_idx" ON "flashcard_reviews"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "flashcard_reviews_flashcardId_idx" ON "flashcard_reviews"("flashcardId");

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
