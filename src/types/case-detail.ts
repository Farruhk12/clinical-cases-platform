import type { BlockType } from "./db";

export type CaseDetail = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  teacherKey: string | null;
  caseVersion: number;
  departmentId: string;
  department: { id: string; name: string };
  caseFaculties: {
    caseId: string;
    facultyId: string;
    faculty: { id: string; name: string };
  }[];
  caseCourseLevels: {
    caseId: string;
    courseLevelId: string;
    courseLevel: { id: string; name: string; sort: number };
  }[];
  stages: {
    id: string;
    caseId: string;
    order: number;
    title: string;
    isFinalReveal: boolean;
    learningGoals: string | null;
    blocks: {
      id: string;
      caseStageId: string;
      order: number;
      blockType: BlockType;
      rawText: string | null;
      formattedContent: string | null;
      imageUrl: string | null;
      imageAlt: string | null;
    }[];
  }[];
};
