-- CreateEnum
CREATE TYPE "ThresholdStatus" AS ENUM ('OK', 'WARNING', 'CRITICAL', 'MISSING', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('SUCCESS', 'DEGRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "RetrievalMode" AS ENUM ('HYBRID', 'KEYWORD_ONLY', 'NONE');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "HypothesisStatus" AS ENUM ('PROPOSED', 'RULED_OUT');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('AI', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "HistoryType" AS ENUM ('REPORT_CREATED', 'THRESHOLDS_EVALUATED', 'ANALYSIS_RUN', 'ANALYSIS_FAILED', 'QUESTION_ANSWERED', 'OBSERVATION_ADDED', 'FINDING_CONFIRMED', 'WORK_ORDER_DRAFTED', 'WORK_ORDER_EDITED', 'WORK_ORDER_APPROVED', 'WORK_ORDER_REJECTED', 'REPORT_CLOSED');

-- CreateTable
CREATE TABLE "ThresholdResult" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "sensor" TEXT NOT NULL,
    "status" "ThresholdStatus" NOT NULL,
    "ruleId" TEXT,
    "observedValue" DOUBLE PRECISION,
    "unit" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThresholdResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "retrievalMode" "RetrievalMode" NOT NULL,
    "model" TEXT,
    "retrievedChunkIds" TEXT[],
    "errorStage" TEXT,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "rawOutput" JSONB,
    "validationNotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hypothesis" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "runId" INTEGER NOT NULL,
    "cause" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "citations" JSONB NOT NULL,
    "status" "HypothesisStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpQuestion" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "runId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "answer" TEXT,
    "answeredBy" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionStep" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "runId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "hypothesisId" INTEGER,
    "description" TEXT NOT NULL,
    "confirmedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedVersion" INTEGER,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderVersion" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "source" "VersionSource" NOT NULL,
    "editedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" SERIAL NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "reportId" INTEGER,
    "type" "HistoryType" NOT NULL,
    "actor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThresholdResult_reportId_idx" ON "ThresholdResult"("reportId");

-- CreateIndex
CREATE INDEX "AnalysisRun_reportId_createdAt_idx" ON "AnalysisRun"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "Hypothesis_reportId_idx" ON "Hypothesis"("reportId");

-- CreateIndex
CREATE INDEX "FollowUpQuestion_reportId_idx" ON "FollowUpQuestion"("reportId");

-- CreateIndex
CREATE INDEX "InspectionStep_reportId_idx" ON "InspectionStep"("reportId");

-- CreateIndex
CREATE INDEX "Observation_reportId_idx" ON "Observation"("reportId");

-- CreateIndex
CREATE INDEX "Finding_reportId_idx" ON "Finding"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_reportId_key" ON "WorkOrder"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderVersion_workOrderId_versionNumber_key" ON "WorkOrderVersion"("workOrderId", "versionNumber");

-- CreateIndex
CREATE INDEX "HistoryEntry_equipmentId_createdAt_idx" ON "HistoryEntry"("equipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportEvent_reportId_idx" ON "ReportEvent"("reportId");

-- AddForeignKey
ALTER TABLE "ThresholdResult" ADD CONSTRAINT "ThresholdResult_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpQuestion" ADD CONSTRAINT "FollowUpQuestion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpQuestion" ADD CONSTRAINT "FollowUpQuestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionStep" ADD CONSTRAINT "InspectionStep_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionStep" ADD CONSTRAINT "InspectionStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderVersion" ADD CONSTRAINT "WorkOrderVersion_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
