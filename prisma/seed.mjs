import { PrismaClient, Gender, PatientState, SessionStatus, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.paymentAllocation.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.invoiceRequest.deleteMany();
  await prisma.sessionNote.deleteMany();
  await prisma.verbatimNote.deleteMany();
  await prisma.task.deleteMany();
  await prisma.session.deleteMany();
  await prisma.intake.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.medicalDocument.deleteMany();
  await prisma.researchLink.deleteMany();
  await prisma.researchDocumentAuthor.deleteMany();
  await prisma.researchDocumentTopic.deleteMany();
  await prisma.researchDocument.deleteMany();
  await prisma.researchNoteTopic.deleteMany();
  await prisma.researchNote.deleteMany();
  await prisma.author.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.patient.deleteMany();

  const [p1, p2, p3] = await Promise.all([
    prisma.patient.create({
      data: {
        internalCode: "PT-2026-001",
        firstName: "אביאל",
        lastName: "לביא",
        gender: Gender.MALE,
        phone: "050-1111111",
        email: "aviel@example.com",
        researchAlias: "P-001",
        defaultSessionFeeNis: 350,
      },
    }),
    prisma.patient.create({
      data: {
        internalCode: "PT-2026-002",
        firstName: "טל",
        lastName: "ארווץ",
        gender: Gender.FEMALE,
        phone: "050-2222222",
        email: "tal@example.com",
        researchAlias: "P-002",
        defaultSessionFeeNis: 350,
      },
    }),
    prisma.patient.create({
      data: {
        internalCode: "PT-2026-003",
        firstName: "עדי",
        lastName: "זכאי",
        gender: Gender.OTHER,
        phone: "050-3333333",
        email: "adi@example.com",
        researchAlias: "P-003",
        defaultSessionFeeNis: 400,
      },
    }),
  ]);

  const now = new Date();
  const today0900 = new Date(now);
  today0900.setHours(9, 0, 0, 0);
  const today1130 = new Date(now);
  today1130.setHours(11, 30, 0, 0);
  const today1600 = new Date(now);
  today1600.setHours(16, 0, 0, 0);
  const yesterday1700 = new Date(now);
  yesterday1700.setDate(now.getDate() - 1);
  yesterday1700.setHours(17, 0, 0, 0);

  await prisma.session.create({
    data: {
      patientId: p1.id,
      scheduledAt: today0900,
      status: SessionStatus.SCHEDULED,
      feeNis: 350,
      location: "קליניקה",
      patientState: PatientState.NO_CHANGE,
    },
  });

  const s2 = await prisma.session.create({
    data: {
      patientId: p2.id,
      scheduledAt: today1130,
      status: SessionStatus.CANCELED_LATE,
      feeNis: 350,
      location: "אונליין",
      cancellationReason: "מחלה",
      patientState: PatientState.ANXIOUS,
    },
  });

  const s3 = await prisma.session.create({
    data: {
      patientId: p3.id,
      scheduledAt: today1600,
      status: SessionStatus.SCHEDULED,
      feeNis: 400,
      location: "קליניקה",
      patientState: PatientState.NO_CHANGE,
    },
  });

  const s4 = await prisma.session.create({
    data: {
      patientId: p1.id,
      scheduledAt: yesterday1700,
      status: SessionStatus.SCHEDULED,
      feeNis: 350,
      location: "קליניקה",
      patientState: PatientState.NO_CHANGE,
    },
  });

  await prisma.task.createMany({
    data: [
      {
        patientId: p1.id,
        sessionId: s4.id,
        title: "להשלים תיעוד לפגישה",
        details: "מפגש שלא תועד מהיום הקודם",
        status: TaskStatus.OPEN,
        dueAt: now,
      },
      {
        patientId: p2.id,
        sessionId: s2.id,
        title: "לבדוק ביטול מאוחר וחיוב",
        status: TaskStatus.OPEN,
        dueAt: now,
      },
      {
        patientId: p3.id,
        sessionId: s3.id,
        title: "שליחת תזכורת פגישה",
        status: TaskStatus.OPEN,
        dueAt: now,
      },
    ],
  });

  const author = await prisma.author.create({ data: { name: "P. Fonagy" } });
  const topic = await prisma.topic.create({ data: { name: "מנטליזציה" } });
  const document = await prisma.researchDocument.create({
    data: {
      title: "Mentalization in Clinical Work",
      publicationYear: 2018,
      source: "Journal of Psychotherapy",
      filePath: "/research/mentalization.pdf",
    },
  });

  await prisma.researchDocumentAuthor.create({
    data: {
      documentId: document.id,
      authorId: author.id,
    },
  });

  await prisma.researchDocumentTopic.create({
    data: {
      documentId: document.id,
      topicId: topic.id,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
