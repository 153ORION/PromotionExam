import React from 'react';
import { TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkQuestionRow } from '@/types';
import { truncate } from '@/lib/bulkQuestionUtils';

// Shared pieces of the Question Bank Excel pages (Upload Excel, Fix Questions).

export const Pager: React.FC<{ page: number; pageCount: number; total: number; onChange: (p: number) => void }> = ({ page, pageCount, total, onChange }) => (
  <div className="flex items-center justify-between gap-3 pt-3 text-xs text-slate-500">
    <span>{total} row(s)</span>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span>Page {page} of {Math.max(1, pageCount)}</span>
      <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);

// Type and Part badges; a disputed value is shown in amber with the value from the file.
export const TypePartBadges: React.FC<{ row: BulkQuestionRow }> = ({ row }) => (
  <div className="flex flex-col gap-1">
    {row.isTypeDisputed ? (
      <Badge variant="warning" className="w-fit" title="Disputed: Type must be MCQ or Descriptive">
        Type: {row.questionType || '(empty)'}
      </Badge>
    ) : (
      <Badge variant={row.isMcq ? 'default' : 'secondary'} className="w-fit">{row.questionType}</Badge>
    )}
    {row.isPartDisputed ? (
      <Badge variant="warning" className="w-fit" title="Disputed: Part must be 1, 2 or 3">
        Part: {row.questionPart || '(empty)'}
      </Badge>
    ) : (
      <span className="text-[11px] text-slate-500">Part {row.questionPart}</span>
    )}
  </div>
);

export const CriteriaCell: React.FC<{ row: BulkQuestionRow }> = ({ row }) => (
  <TableCell className="align-top text-xs text-slate-600 min-w-[160px]">
    <div className="font-medium text-slate-800">{row.department || '—'}</div>
    <div>{row.jobConcentration}</div>
    <div className="text-slate-400">{[row.grade, row.location].filter(Boolean).join(' · ')}</div>
  </TableCell>
);

// Question text with MCQ options (right answer highlighted) or the descriptive answer.
export const QuestionCell: React.FC<{ row: BulkQuestionRow; children?: React.ReactNode }> = ({ row, children }) => {
  const options = [row.option1, row.option2, row.option3, row.option4];
  const answerNo = Number(row.rightAnswer);
  const hasOptions = options.some(Boolean);
  return (
    <TableCell className="align-top text-sm text-slate-800 min-w-[280px] max-w-[520px]">
      <div className="whitespace-pre-wrap" title={row.question}>{truncate(row.question, 300)}</div>
      {hasOptions ? (
        <ol className="mt-1.5 space-y-0.5 text-xs text-slate-600">
          {options.map((o, i) => o ? (
            <li key={i} className={cn(answerNo === i + 1 && 'font-semibold text-emerald-700')}>
              {i + 1}. {o} {answerNo === i + 1 && <CheckCircle className="inline h-3 w-3 ml-0.5" />}
            </li>
          ) : null)}
        </ol>
      ) : row.rightAnswer ? (
        <div className="mt-1.5 text-xs text-slate-500 whitespace-pre-wrap" title={row.rightAnswer}>
          <span className="font-semibold text-slate-600">Answer: </span>{truncate(row.rightAnswer, 200)}
        </div>
      ) : null}
      {children}
    </TableCell>
  );
};
