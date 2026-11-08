import { ExamRegistration } from '@/types';

// Exam_Registration.ExamStart/ExamEnd are written by SP_APP_EXAM_START with GETUTCDATE() and arrive
// without a time zone, so they are read as UTC.
export const parseUtc = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
  return isNaN(date.getTime()) ? null : date;
};

export const formatExamTime = (value?: string): string => {
  const date = parseUtc(value);
  return date ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-';
};

export type ExamStatus = 'completed' | 'in-progress' | 'not-submitted' | 'not-started';

// Completed: the candidate finished the exam (SP_APP_EXAM_END sets IsExamEnd). A started exam is in
// progress until its ExamEnd; after that it was never finished and has only the answers saved one by one.
export const examStatus = (r: ExamRegistration, now: Date = new Date()): ExamStatus => {
  if (r.isExamEnd) return 'completed';
  if (!r.examStart && !r.isAttand) return 'not-started';
  const end = parseUtc(r.examEnd);
  return end && end > now ? 'in-progress' : 'not-submitted';
};

export const EXAM_STATUS: Record<ExamStatus, { label: string; hint: string; className: string }> = {
  'completed': {
    label: 'Completed',
    hint: 'The candidate finished and submitted the exam.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  'in-progress': {
    label: 'In Progress',
    hint: 'The exam is running; the answers saved so far are shown.',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  'not-submitted': {
    label: 'Not Submitted',
    hint: 'The exam time is over but the candidate never finished it; the answers saved before that are shown.',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'not-started': {
    label: 'Not Started',
    hint: 'The candidate has not started the exam.',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};
