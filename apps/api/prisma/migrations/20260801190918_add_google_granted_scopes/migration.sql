-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleGrantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
