export interface User {
  hrRecordId: number;
  loginId: string;
  name: string;
  email?: string;
  mobile?: string;
  designation?: string;
  gradeName?: string;
  companyName?: string;
  departmentName?: string;
  locationName?: string;
  profilePhoto?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isActive?: boolean;
}

export interface MenuItem {
  id: number;
  parentId: number;
  menuName: string;
  targetUrl?: string;
  menuLogo?: string;
  color?: string;
  serialNo?: number;
  children: MenuItem[];
}

export interface LoginResponse {
  token: string;
  hrRecordId: number;
  loginId: string;
  name: string;
  email?: string;
  designation?: string;
  companyName?: string;
  departmentName?: string;
  locationName?: string;
  profilePhoto?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  menus: MenuItem[];
}

export interface LookupType {
  typeId: number;
  lookupType: string;
  serial?: number;
  isActive?: boolean;
  entryDate?: string;
}

export interface LookupOverview {
  total: number;
  active: number;
  inActive: number;
}

export interface LookupItem {
  lookupId: number;
  typeId: number;
  typeName?: string;
  lookupText: string;
  lookupTextShort?: string;
  serial?: number;
  isActive?: boolean;
  entryDate?: string;
}

export interface QuestionSet {
  setId: number;
  setName: string;
  locationId?: number;
  locationName?: string;
  departmentId?: number;
  departmentName?: string;
  gradeId?: number;
  gradeName?: string;
  concentrationId?: number;
  concentrationName?: string;
  isActive?: boolean;
  questionCount: number;
  entryDate?: string;
}

export interface QuestionOption {
  answerId?: number;
  answerDetails: string;
  answerSerial: number;
  isRight: boolean;
}

export interface Question {
  questionId: number;
  setId: number;
  setName?: string;
  typeId: number; // 1 = MCQ, 2 = Narrative
  questionType: string;
  question: string;
  narrativeAnswer?: string;
  marks: number;
  isActive?: boolean;
  entryDate?: string;
  aiRubricStatus?: string;
  aiRubricVersionNo?: number;
  aiRubricNeedsRegeneration?: boolean;
  aiRubricCriteriaCount?: number;
  aiRubricSummary?: string;
  aiRubricGeneratedAt?: string;
  answers: QuestionOption[];
}

export interface ExamBatch {
  batchId: number;
  examName: string;
  examYear: number;
  examStart?: string;
  examEnd?: string;
  mcqQuestion?: number;
  maxMCQ?: number;
  mcqMark?: number;
  academicQuestion?: number;
  maxAcademic?: number;
  generalQuestion?: number;
  maxGeneral?: number;
  jobRelatedQuestion?: number;
  maxJobRelated?: number;
  totalWrittenQuestion?: number;
  writtenMark?: number;
  totalMark?: number;
  examDuration?: number;
  isActive?: boolean;
  isMultipleExaminer?: boolean;
  allowPreviewMarking?: boolean;
}

export interface Flowpath {
  path_Id: number;
  batchId: number;
  batchName?: string;
  examSetId: number;
  setName?: string;
  examinerId: number;
  examinerName?: string;
  examinerDesignation?: string;
  examinerDepartment?: string;
  rank: number;
  approver?: boolean;
  entryDate?: string;
}

export interface ExamRegistration {
  examineeId: number;
  hrRecordId: number;
  loginId: string;
  examineeName: string;
  designation?: string;
  departmentName?: string;
  companyName?: string;
  locationName?: string;
  gradeName?: string;
  batchId: number;
  batchName?: string;
  questionSetId: number;
  setName?: string;
  examGradeId?: number;
  mcqScore?: number;
  writtenScore?: number;
  totalScore?: number;
  examStart?: string;
  examEnd?: string;
  isAttand?: boolean;
  isExamEnd?: boolean;
  isTimeExpire?: boolean;
  isActive?: boolean;
}

export interface NarrativeCandidate {
  examineeId: number;
  loginId: string;
  name: string;
  designation?: string;
  departmentName?: string;
  batchId: number;
  questionSetId: number;
  isEvaluated: boolean;
  isEvaluatedByMe?: boolean;
  examinersCount?: number;
  currentNarrativeScore?: number;
  myNarrativeScore?: number;
  avgNarrativeScore?: number;
  isFinalized?: boolean;
  finalApproverName?: string;
  finalApproverScore?: number;
}

export interface ExaminerScorePreview {
  scoreId: number;
  examinerId: number;
  examinerName: string;
  designation?: string;
  departmentName?: string;
  role: string;
  rank: number;
  isApprover: boolean;
  marks: number;
  remarks?: string;
  entryDate?: string;
  formattedDate?: string;
  isCurrentExaminer: boolean;
}

export interface CandidateNarrativeQuestion {
  questionId: number;
  question: string;
  modelAnswer?: string;
  maxMarks: number;
  candidateAnswer?: string;
  myMarks?: number;
  myRemarks?: string;
  avgMarks?: number;
  scoredExaminerCount?: number;
  examinerScores: ExaminerScorePreview[];
  isFinalized?: boolean;
  canEdit?: boolean;
  finalApproverName?: string;
  isCurrentExaminerApprover?: boolean;
  aiRubricStatus?: string;
  aiRubricVersionNo?: number;
  aiRubricNeedsRegeneration?: boolean;
  aiEvaluation?: AiNarrativeEvaluation;
  awardedMarks?: number;
  remarks?: string;
}

export interface AiRubricCriterion {
  rubricDetailId: number;
  criterionTitle: string;
  expectedConcept: string;
  scoringGuidance?: string;
  maxMarks: number;
  sortOrder: number;
  keywords: string[];
  commonMistakes: string[];
}

export interface AiRubric {
  rubricMasterId: number;
  questionId: number;
  versionNo: number;
  status: string;
  isActive: boolean;
  needsRegeneration: boolean;
  subjectSnapshot?: string;
  maxMarks: number;
  rubricSummary?: string;
  sourceModel?: string;
  promptVersion?: string;
  entryDate?: string;
  criteriaCount: number;
  criteria: AiRubricCriterion[];
}

export interface AiEvaluationCriterion {
  rubricDetailId: number;
  criterionTitle: string;
  awardedMarks: number;
  maxMarks: number;
  reason: string;
}

export interface AiNarrativeEvaluation {
  aiEvaluationId: number;
  examineeId: number;
  questionId: number;
  rubricMasterId: number;
  rubricVersionNo: number;
  awardedMarks: number;
  maxMarks: number;
  confidence: number;
  summary?: string;
  strengths: string[];
  missingPoints: string[];
  incorrectPoints: string[];
  criterionBreakdown: AiEvaluationCriterion[];
  validationStatus: string;
  validationNotes?: string;
  reviewRecommended: boolean;
  sourceModel?: string;
  promptVersion?: string;
  entryDate?: string;
  isCached: boolean;
  isValidSuggestion: boolean;
}

export interface ExamineeResultSummary {
  examineeId: number;
  loginId: string;
  name: string;
  designation?: string;
  departmentName?: string;
  companyName?: string;
  locationName?: string;
  gradeName?: string;
  batchName?: string;
  setName?: string;
  mcqScore: number;
  writtenScore: number;
  totalScore: number;
  totalPossibleMarks: number;
  isPassed: boolean;
  isAttended: boolean;
  examDate?: string;
}

export interface DashboardStats {
  totalExaminees: number;
  totalExaminers: number;
  totalBatches: number;
  totalQuestionSets: number;
  totalMCQQuestions: number;
  totalWrittenQuestions: number;
  totalCompletedExams: number;
}
