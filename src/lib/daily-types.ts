import { DailyEntryStatus, DailyEntryType, DailyTargetEntityType } from "@prisma/client";

export type DailyParseResult = {
  type: DailyEntryType;
  patientName: string | null;
  matchedPatientId: string | null;
  matchedPatientName: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  content: string;
  title: string | null;
  parserProvider: string | null;
  parserConfidence: number | null;
  parseMetaJson: Record<string, unknown> | null;
};

export type DailyEntryViewModel = {
  id: string;
  rawText: string;
  parsedType: DailyEntryType;
  status: DailyEntryStatus;
  matchedPatientId: string | null;
  matchedPatientName: string | null;
  entryDate: string;
  entryTime: string | null;
  content: string;
  title: string | null;
  parserProvider: string | null;
  parserConfidence: number | null;
  targetEntityType: DailyTargetEntityType | null;
  targetEntityId: string | null;
  createdAt: string;
  updatedAt: string;
};

