-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."InquiryStatus" AS ENUM ('NEW', 'DISCOVERY_CALL', 'WAITLIST', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED', 'CANCELED_LATE', 'UNDOCUMENTED');

-- CreateEnum
CREATE TYPE "public"."PatientState" AS ENUM ('NO_CHANGE', 'ANXIOUS', 'RISK', 'MANIC', 'PSYCHOTIC');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."MedicalDocumentKind" AS ENUM ('EVALUATION', 'TEST_RESULT', 'HOSPITAL_SUMMARY', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."BillingStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ResearchItemKind" AS ENUM ('ARTICLE', 'BOOK', 'VIDEO', 'LECTURE_NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ResearchTargetType" AS ENUM ('PATIENT', 'SESSION', 'TASK', 'RECEIPT', 'INQUIRY', 'RESEARCH_DOCUMENT', 'RESEARCH_NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FigureRole" AS ENUM ('MOTHER', 'FATHER', 'SISTER', 'BROTHER', 'PARTNER', 'FRIEND', 'COLLEAGUE', 'ACQUAINTANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."GuidanceStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profession" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Patient" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "internalCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarKey" TEXT,
    "gender" "public"."Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "treatmentStartDate" TIMESTAMP(3),
    "fixedSessionDay" INTEGER,
    "fixedSessionTime" TEXT,
    "researchAlias" TEXT,
    "defaultSessionFeeNis" INTEGER,
    "lateCancelCharge" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inquiry" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "patientId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gender" "public"."Gender",
    "age" INTEGER,
    "referralSource" TEXT,
    "referralDetails" TEXT,
    "status" "public"."InquiryStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Intake" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "referralReason" TEXT,
    "goals" TEXT,
    "previousTherapy" TEXT,
    "currentMedication" TEXT,
    "hospitalizations" TEXT,
    "riskAssessment" TEXT,
    "freeText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "isRecurringTemplate" BOOLEAN NOT NULL DEFAULT false,
    "feeNis" INTEGER,
    "patientState" "public"."PatientState" NOT NULL DEFAULT 'NO_CHANGE',
    "riskFlag" BOOLEAN NOT NULL DEFAULT false,
    "riskNote" TEXT,
    "cancellationReason" TEXT,
    "canceledAt" TIMESTAMP(3),
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerbatimNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerbatimNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "patientId" TEXT,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "periodLabel" TEXT,
    "amountNis" INTEGER NOT NULL,
    "status" "public"."BillingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Receipt" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amountNis" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "amountNis" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicalDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" "public"."MedicalDocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "ocrText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Author" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchDocument" (
    "id" TEXT NOT NULL,
    "kind" "public"."ResearchItemKind" NOT NULL DEFAULT 'ARTICLE',
    "title" TEXT NOT NULL,
    "publicationYear" INTEGER,
    "source" TEXT,
    "sourceId" TEXT,
    "externalUrl" TEXT,
    "filePath" TEXT,
    "ocrText" TEXT,
    "workspaceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchDocumentAuthor" (
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "ResearchDocumentAuthor_pkey" PRIMARY KEY ("documentId","authorId")
);

-- CreateTable
CREATE TABLE "public"."ResearchDocumentTopic" (
    "documentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "ResearchDocumentTopic_pkey" PRIMARY KEY ("documentId","topicId")
);

-- CreateTable
CREATE TABLE "public"."ResearchNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchNoteTopic" (
    "noteId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "ResearchNoteTopic_pkey" PRIMARY KEY ("noteId","topicId")
);

-- CreateTable
CREATE TABLE "public"."ResearchLink" (
    "id" TEXT NOT NULL,
    "researchDocumentId" TEXT,
    "researchNoteId" TEXT,
    "targetEntityType" "public"."ResearchTargetType" NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "targetEntityAlias" TEXT,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatientNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatientConceptLink" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientConceptLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatientFigure" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."FigureRole" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFigure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountNis" INTEGER NOT NULL,
    "category" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guidanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Instructor" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guidance" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "instructorId" TEXT,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "contentMarkdown" TEXT NOT NULL,
    "notesMarkdown" TEXT NOT NULL,
    "status" "public"."GuidanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "feeNis" INTEGER,
    "completedAt" TIMESTAMP(3),
    "attachmentFilePath" TEXT,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guidance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuidanceSession" (
    "guidanceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidanceSession_pkey" PRIMARY KEY ("guidanceId","sessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_internalCode_key" ON "public"."Patient"("internalCode");

-- CreateIndex
CREATE INDEX "Patient_ownerUserId_archivedAt_idx" ON "public"."Patient"("ownerUserId", "archivedAt");

-- CreateIndex
CREATE INDEX "Inquiry_ownerUserId_status_idx" ON "public"."Inquiry"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "Session_scheduledAt_idx" ON "public"."Session"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionNote_sessionId_key" ON "public"."SessionNote"("sessionId");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "public"."Task"("dueAt");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "public"."Task"("status");

-- CreateIndex
CREATE INDEX "Task_ownerUserId_status_idx" ON "public"."Task"("ownerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRequest_requestNumber_key" ON "public"."InvoiceRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "public"."Receipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_receiptId_sessionId_key" ON "public"."PaymentAllocation"("receiptId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Author_name_key" ON "public"."Author"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "public"."Topic"("name");

-- CreateIndex
CREATE INDEX "ResearchDocument_createdAt_idx" ON "public"."ResearchDocument"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSource_name_key" ON "public"."ResearchSource"("name");

-- CreateIndex
CREATE INDEX "ResearchNote_createdAt_idx" ON "public"."ResearchNote"("createdAt");

-- CreateIndex
CREATE INDEX "ResearchLink_targetEntityType_targetEntityId_idx" ON "public"."ResearchLink"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_guidanceId_key" ON "public"."Expense"("guidanceId");

-- CreateIndex
CREATE INDEX "Instructor_ownerUserId_fullName_idx" ON "public"."Instructor"("ownerUserId", "fullName");

-- CreateIndex
CREATE INDEX "Guidance_patientId_status_idx" ON "public"."Guidance"("patientId", "status");

-- CreateIndex
CREATE INDEX "Guidance_updatedAt_idx" ON "public"."Guidance"("updatedAt");

-- CreateIndex
CREATE INDEX "Guidance_scheduledAt_idx" ON "public"."Guidance"("scheduledAt");

-- CreateIndex
CREATE INDEX "GuidanceSession_sessionId_idx" ON "public"."GuidanceSession"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inquiry" ADD CONSTRAINT "Inquiry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inquiry" ADD CONSTRAINT "Inquiry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Intake" ADD CONSTRAINT "Intake_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerbatimNote" ADD CONSTRAINT "VerbatimNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerbatimNote" ADD CONSTRAINT "VerbatimNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalDocument" ADD CONSTRAINT "MedicalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalDocument" ADD CONSTRAINT "MedicalDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchDocument" ADD CONSTRAINT "ResearchDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."ResearchSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchDocumentAuthor" ADD CONSTRAINT "ResearchDocumentAuthor_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."ResearchDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchDocumentAuthor" ADD CONSTRAINT "ResearchDocumentAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchDocumentTopic" ADD CONSTRAINT "ResearchDocumentTopic_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."ResearchDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchDocumentTopic" ADD CONSTRAINT "ResearchDocumentTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchNoteTopic" ADD CONSTRAINT "ResearchNoteTopic_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."ResearchNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchNoteTopic" ADD CONSTRAINT "ResearchNoteTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchLink" ADD CONSTRAINT "ResearchLink_researchDocumentId_fkey" FOREIGN KEY ("researchDocumentId") REFERENCES "public"."ResearchDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchLink" ADD CONSTRAINT "ResearchLink_researchNoteId_fkey" FOREIGN KEY ("researchNoteId") REFERENCES "public"."ResearchNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientNote" ADD CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientConceptLink" ADD CONSTRAINT "PatientConceptLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientFigure" ADD CONSTRAINT "PatientFigure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_guidanceId_fkey" FOREIGN KEY ("guidanceId") REFERENCES "public"."Guidance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Instructor" ADD CONSTRAINT "Instructor_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guidance" ADD CONSTRAINT "Guidance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guidance" ADD CONSTRAINT "Guidance_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidanceSession" ADD CONSTRAINT "GuidanceSession_guidanceId_fkey" FOREIGN KEY ("guidanceId") REFERENCES "public"."Guidance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidanceSession" ADD CONSTRAINT "GuidanceSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

