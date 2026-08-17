/*
  Warnings:

  - You are about to drop the `class_notes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "class_notes" DROP CONSTRAINT "class_notes_classId_fkey";

-- DropForeignKey
ALTER TABLE "class_notes" DROP CONSTRAINT "class_notes_createdById_fkey";

-- DropTable
DROP TABLE "class_notes";
