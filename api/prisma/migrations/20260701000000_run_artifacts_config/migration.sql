-- AlterTable
ALTER TABLE "Project" ADD COLUMN "runArtifactsConfig" TEXT NOT NULL DEFAULT '{"screenshot":"on-failure","video":"on-failure"}';

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN "stepsJson" TEXT NOT NULL DEFAULT '[]';
