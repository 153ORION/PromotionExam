import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, UserX, Users } from 'lucide-react';
import { ExamRegistration, ExamBatch, LookupItem } from '@/types';

interface SetOption {
  setId: number;
  setName: string;
  count: number;
}

export const UnregistrationPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [batchRegistrations, setBatchRegistrations] = useState<ExamRegistration[]>([]);
  const [setOptions, setSetOptions] = useState<SetOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [examYears, setExamYears] = useState<{ value: number; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // On mount: load batches + exam year lookups (typeid = 1) — no auto-select
  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resYears] = await Promise.all([
          api.get('/batches'),
          api.get('/lookups/items', { params: { typeId: 1 } })
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        setExamYears(
          ((resYears.data || []) as LookupItem[]).map((y) => ({
            value: Number(y.lookupText) || y.lookupId,
            label: y.lookupText
          }))
        );
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  // Load ACTIVE registrations (IsActive = 1 only) filtered by batch, or by year across all batches
  const loadRegistrations = async (filters?: { batchId?: number; year?: number }) => {
    const fBatchId = filters?.batchId !== undefined ? filters.batchId : selectedBatchId;
    const fYear = filters?.year !== undefined ? filters.year : selectedYear;
    if (fBatchId <= 0 && fYear <= 0) {
      setBatchRegistrations([]);
      setSetOptions([]);
      return;
    }

    setLoading(true);
    try {
      // Backend returns only IsActive = 1 records from Exam_Registration
      const res = await api.get('/registrations', {
        params: {
          batchId: fBatchId > 0 ? fBatchId : undefined,
          year: fBatchId <= 0 && fYear > 0 ? fYear : undefined
        }
      });
      const regs: ExamRegistration[] = res.data || [];
      setBatchRegistrations(regs);

      // Set dropdown is built from the loaded registrations
      const distinctSets = Array.from(
        new Map(regs.map((r) => [r.questionSetId, r.setName || 'Default Set'])).entries()
      ).map(([setId, setName]) => ({
        setId,
        setName,
        count: regs.filter((r) => r.questionSetId === setId).length
      }));
      setSetOptions(distinctSets);
    } catch (err) {
      console.error(err);
      setBatchRegistrations([]);
      setSetOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // When year changes: reset batch/set selections and load all batches of that year
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedBatchId(0);
    setSelectedSetId(0);
    setBatchRegistrations([]);
    setSetOptions([]);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (year > 0) loadRegistrations({ batchId: 0, year });
  };

  // When batch changes: reset Set selection + registrations, then load batch data
  const handleBatchChange = (batchId: number) => {
    setSelectedBatchId(batchId);
    setSelectedSetId(0);
    setBatchRegistrations([]);
    setSetOptions([]);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (batchId > 0) loadRegistrations({ batchId });
    else if (selectedYear > 0) loadRegistrations({ batchId: 0, year: selectedYear });
  };

  // When set changes: just refresh feedback messages (0 = All Sets)
  const handleSetChange = (setId: number) => {
    setSelectedSetId(setId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Examinees are listed once a Batch (or Year) is selected;
  // if a specific Set is chosen, filter to that set only
  const visibleRegistrations =
    selectedBatchId > 0 || selectedYear > 0
      ? batchRegistrations.filter((r) => selectedSetId <= 0 || r.questionSetId === selectedSetId)
      : [];

  // Soft delete: PATCH /registrations/{id}/deactivate sets IsActive = 0 only.
  // No registration-related data (answers, scores, question sheets) is deleted.
  const handleUnregister = async (examineeId: number, name: string) => {
    if (!confirm(`Are you sure you want to unregister ${name} from this exam batch?`)) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.patch(`/registrations/${examineeId}/deactivate`);
      setSuccessMessage(`${name} has been unregistered successfully (soft deleted — IsActive set to 0).`);
      await loadRegistrations();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to unregister examinee.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Examinee Unregistration & Roster</h2>
          <p className="text-sm text-slate-500">
            View active candidates (IsActive = 1) registered for exams and remove eligible candidates if needed. Unregistration is a soft delete — no registration data is removed.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center space-x-2 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center space-x-2 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value={0}>-- All Years --</option>
              {examYears.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Examination Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => handleBatchChange(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value={0}>-- All Batches --</option>
              {batches
                .filter((b) => selectedYear <= 0 || b.examYear === selectedYear)
                .map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.examName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Question Set:</span>
            <select
              value={selectedSetId}
              onChange={(e) => handleSetChange(Number(e.target.value))}
              disabled={selectedBatchId <= 0 && selectedYear <= 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value={0}>-- All Sets --</option>
              {setOptions.map((s) => (
                <option key={s.setId} value={s.setId}>
                  {s.setName} ({s.count})
                </option>
              ))}
            </select>
          </div>

          {(selectedBatchId > 0 || selectedYear > 0) && (
            <div className="ml-auto text-xs font-semibold text-slate-500">
              Active Registered: {visibleRegistrations.length}
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Registered Examinees</CardTitle>
          <CardDescription>Active candidates assigned to the selected exam batch/year and question set.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Designation & Dept</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Set Name</TableHead>
                <TableHead>Exam Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedBatchId <= 0 && selectedYear <= 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">Select a Year or Exam Batch to continue</p>
                      <p className="text-xs text-slate-400">Pick a year to see all its batches, or choose a specific batch, then select a question set.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading registrations...
                  </TableCell>
                </TableRow>
              ) : visibleRegistrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No active examinees found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRegistrations.map((r) => (
                  <TableRow key={r.examineeId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{r.examineeId}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{r.examineeName}</div>
                      <div className="text-xs text-slate-500">ID: {r.loginId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{r.designation || 'Staff'}</div>
                      <div className="text-xs text-slate-500">{r.departmentName || 'General'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.batchName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{r.setName || '-'}</TableCell>
                    <TableCell>
                      {r.isExamEnd ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Submitted</Badge>
                      ) : r.isAttand ? (
                        <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                      ) : (
                        <Badge variant="secondary">Registered</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUnregister(r.examineeId, r.examineeName)}
                        className="text-xs"
                      >
                        <UserX className="h-3.5 w-3.5 mr-1" /> Unregister
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
