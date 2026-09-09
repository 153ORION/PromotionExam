import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  UserCheck, 
  GitBranch, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Flowpath, ExamBatch, QuestionSet, ActiveEmployee } from '@/types';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';

export const AssignExaminerPage: React.FC = () => {
  const navigate = useNavigate();

  // Reference lists
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [examiners, setExaminers] = useState<ActiveEmployee[]>([]);
  const [searchingExaminers, setSearchingExaminers] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [selectedExaminerId, setSelectedExaminerId] = useState<number>(0);
  const [rank, setRank] = useState<number>(2); // rank 1 is reserved for AI Examiner
  const [isApprover, setIsApprover] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  // Feedback states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Context: existing examiners for selected Batch & Set
  const [existingFlowpaths, setExistingFlowpaths] = useState<Flowpath[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const searchDebounceRef = useRef<any>(null);

  // On mount: load only batches
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingInitial(true);
      try {
        const resBatches = await api.get('/batches');
        const activeBatches: ExamBatch[] = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        // Do NOT auto-select — start with "-- Select Batch --"
      } catch (err: any) {
        console.error('Failed to load batches:', err);
        setErrorMsg('Failed to load batches from server.');
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchInitialData();
  }, []);

  // When batch changes: load sets and reset
  const handleBatchChange = async (batchId: number) => {
    setSelectedBatchId(batchId);
    setSelectedSetId(0);
    setSets([]);
    setExistingFlowpaths([]);
    setSuccessMsg(null);
    setErrorMsg(null);

    if (batchId <= 0) return;

    try {
      const resSets = await api.get('/questions/sets');
      const activeSets: QuestionSet[] = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
      setSets(activeSets);
    } catch (err: any) {
      console.error('Failed to load sets:', err);
    }
  };

  // When set changes
  const handleSetChange = (setId: number) => {
    setSelectedSetId(setId);
    setExistingFlowpaths([]);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // Fetch existing examiners assigned to the selected Batch and Set
  const fetchExistingForSet = async (batchId: number, setId: number) => {
    if (batchId <= 0 || setId <= 0) {
      setExistingFlowpaths([]);
      return;
    }

    setLoadingExisting(true);
    try {
      const res = await api.get('/flowpaths', {
        params: { batchId, setId }
      });
      const paths: Flowpath[] = res.data || [];
      setExistingFlowpaths(paths);
      // Auto-increment next rank (starting from 2 at minimum, since rank 1 is AI)
      const nextRank = Math.max(2, paths.length + 1);
      setRank(nextRank);
    } catch (err) {
      console.error('Failed to load existing flow paths:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId > 0 && selectedSetId > 0) {
      fetchExistingForSet(selectedBatchId, selectedSetId);
    }
  }, [selectedBatchId, selectedSetId]);

  // Live employee search
  const handleExaminerSearch = (term: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!term.trim()) return;

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setSearchingExaminers(true);
        const res = await api.get('/flowpaths/examiners', { params: { search: term.trim() } });
        const results: ActiveEmployee[] = res.data || [];
        setExaminers((prev) => {
          const newIds = new Set(results.map((r) => r.hrRecordId));
          const rest = prev.filter((p) => !newIds.has(p.hrRecordId));
          return [...results, ...rest];
        });
      } catch (err) {
        console.error('Failed to search examiners:', err);
      } finally {
        setSearchingExaminers(false);
      }
    }, 300);
  };

  const selectedEmployee = examiners.find((e) => e.hrRecordId === selectedExaminerId);
  const selectedBatch = batches.find((b) => b.batchId === selectedBatchId);
  const selectedSet = sets.find((s) => s.setId === selectedSetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (selectedBatchId <= 0) {
      setErrorMsg('Please select a valid Exam Batch.');
      return;
    }
    if (selectedSetId <= 0) {
      setErrorMsg('Please select a valid Question Set.');
      return;
    }
    if (selectedExaminerId <= 0) {
      setErrorMsg('Please search and select an Examiner.');
      return;
    }
    if (Number(rank) <= 1) {
      setErrorMsg('Rank 1 is reserved for the AI Examiner (system). Please use Rank 2 or higher.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/flowpaths', {
        batchId: selectedBatchId,
        examSetId: selectedSetId,
        examinerId: selectedExaminerId,
        rank: Number(rank),
        approver: isApprover
      });

      setSuccessMsg(
        `Successfully assigned "${selectedEmployee?.name}" (${selectedEmployee?.loginId}) to "${selectedSet?.setName}" at Rank ${rank}.`
      );

      // Refresh existing list and reset examiner selection
      await fetchExistingForSet(selectedBatchId, selectedSetId);
      setSelectedExaminerId(0);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to assign examiner to flow path.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExisting = async (id: number) => {
    if (!confirm('Are you sure you want to remove this examiner from the flow path?')) return;
    try {
      await api.delete(`/flowpaths/${id}`);
      fetchExistingForSet(selectedBatchId, selectedSetId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove assignment.');
    }
  };

  const examinerOptions: SearchableSelectOption[] = examiners.map((u) => ({
    id: u.hrRecordId,
    code: u.loginId,
    title: u.name,
    subtitle: [u.designation, u.departmentName].filter(Boolean).join(' • ')
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <Link
            to="/marking/flow-path"
            className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors space-x-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Flow Path Routing</span>
          </Link>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <UserCheck className="h-6 w-6 text-blue-600" />
            <span>Assign Examiner to Flow Path</span>
          </h2>
          <p className="text-sm text-slate-500">
            Configure evaluation routing orders and authorized approvers for paper marking.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate('/marking/flow-path')}
            className="text-slate-700 hover:bg-slate-100"
          >
            <GitBranch className="h-4 w-4 mr-1.5 text-slate-500" />
            <span>View All Flow Paths</span>
          </Button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/marking/flow-path')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Go to List
            </Button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setErrorMsg(null)}
            className="text-red-700 border-red-300 hover:bg-red-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Grid: Form on Left, Contextual Existing Assignments on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Assignment Form (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-800">
                Examiner Assignment Details
              </CardTitle>
              <CardDescription>
                Select the target exam batch, question set, and active employee to assign.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5 pt-5">
                {/* Exam Batch */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <span>1. Exam Batch <span className="text-red-500">*</span></span>
                    {selectedBatch && (
                      <span className="text-xs font-normal text-slate-500">
                        Year: {selectedBatch.examYear}
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => handleBatchChange(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    required
                  >
                    <option value={0}>-- Select Batch --</option>
                    {batches.map((b) => (
                      <option key={b.batchId} value={b.batchId}>
                        {b.examName} ({b.examYear})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question Set */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <span>2. Question Set <span className="text-red-500">*</span></span>
                    {selectedSet?.departmentName && (
                      <span className="text-xs font-normal text-slate-500">
                        Dept: {selectedSet.departmentName}
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedSetId}
                    onChange={(e) => handleSetChange(Number(e.target.value))}
                    disabled={selectedBatchId <= 0}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  >
                    <option value={0}>-- Select Set --</option>
                    {sets.map((s) => (
                      <option key={s.setId} value={s.setId}>
                        {s.setName} {s.departmentName ? `— (${s.departmentName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Examiner Rank 1 Notice */}
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3.5 text-sm flex items-start space-x-3">
                  <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-indigo-900">Rank 1 — AI Examiner (System Reserved)</p>
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      Rank 1 is automatically reserved for the AI Examiner on every flow path. You may only assign human examiners starting from Rank 2.
                    </p>
                  </div>
                </div>

                {/* Searchable Examiner Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <span>3. Examiner / Faculty <span className="text-red-500">*</span></span>
                    <span className="text-xs font-normal text-slate-500">
                      Search active employee
                    </span>
                  </label>
                  <SearchableSelect
                    options={examinerOptions}
                    selectedId={selectedExaminerId || undefined}
                    onSelect={(opt) => setSelectedExaminerId(opt ? Number(opt.id) : 0)}
                    placeholder="Search by employee code (e.g. 0100352) or name..."
                    searchPlaceholder="Type employee code or name to search..."
                    loading={searchingExaminers}
                    onSearchChange={handleExaminerSearch}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    All active employees across the organization are eligible to be assigned as examiners.
                  </p>
                </div>

                {/* Selected Employee Summary Card */}
                {selectedEmployee && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3.5 text-sm space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-base">{selectedEmployee.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-white text-blue-700 border border-blue-300">
                        Code: {selectedEmployee.loginId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1 pt-1">
                      {selectedEmployee.designation && (
                        <span>Designation: <strong>{selectedEmployee.designation}</strong></span>
                      )}
                      {selectedEmployee.departmentName && (
                        <span>Department: <strong>{selectedEmployee.departmentName}</strong></span>
                      )}
                      {selectedEmployee.locationName && (
                        <span>Location: <strong>{selectedEmployee.locationName}</strong></span>
                      )}
                    </div>
                  </div>
                )}

                {/* Rank & Approver Flag */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      4. Evaluation Rank <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="2"
                      value={rank}
                      onChange={(e) => setRank(Number(e.target.value))}
                      className="w-full"
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      Rank 2 or higher (Rank 1 is reserved for AI Examiner).
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-sm font-semibold text-slate-700 block">
                      5. Role Designation
                    </label>
                    <div className="flex items-center space-x-2.5 pt-2">
                      <input
                        type="checkbox"
                        id="approverCheckbox"
                        checked={isApprover}
                        onChange={(e) => setIsApprover(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="approverCheckbox" className="text-sm font-medium text-slate-800 cursor-pointer">
                        Authorized Final Approver
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-6">
                      Examiner can provide final mark approval and submission.
                    </p>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex items-center justify-between p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/marking/flow-path')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || loadingInitial}
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]"
                >
                  {submitting ? 'Assigning Examiner...' : 'Confirm Assignment'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Existing Assignments Preview Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <GitBranch className="h-4 w-4 text-blue-600" />
                  <span>Current Path for Selected Set</span>
                </CardTitle>
                {selectedBatchId > 0 && selectedSetId > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fetchExistingForSet(selectedBatchId, selectedSetId)}
                    className="h-7 px-2 text-xs text-slate-500"
                    title="Refresh list"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingExisting ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
              <CardDescription className="text-xs">
                Existing evaluators configured for {selectedSet?.setName || 'this paper set'}.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {selectedBatchId <= 0 || selectedSetId <= 0 ? (
                <div className="py-10 text-center px-4 space-y-2">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Select Batch and Set</p>
                  <p className="text-[11px] text-slate-500">
                    Choose an exam batch and question set to see the current flow path assignments.
                  </p>
                </div>
              ) : loadingExisting ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Loading current evaluators...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs">Rank</TableHead>
                      <TableHead className="text-xs">Examiner</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* AI Examiner placeholder at Rank 1 */}
                    <TableRow className="bg-indigo-50/40">
                      <TableCell className="text-center font-bold text-indigo-700 text-xs">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 mx-auto">
                          1
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-indigo-900">AI Examiner (System)</div>
                            <div className="text-[11px] text-indigo-600">Auto-configured · Not removable</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px] px-1.5 py-0">
                          AI Evaluator
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* No delete button for AI Examiner */}
                      </TableCell>
                    </TableRow>

                    {existingFlowpaths.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-slate-500">
                          <p className="font-semibold text-slate-700">No Human Evaluators Assigned Yet</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Use the form on the left to assign evaluators starting from Rank 2.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      existingFlowpaths.map((f) => (
                        <TableRow key={f.path_Id}>
                          <TableCell className="text-center font-bold text-blue-700 text-xs">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 mx-auto">
                              {f.rank}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {f.examinerName || `ID: ${f.examinerId}`}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                              {f.examinerCode && (
                                <span className="font-mono bg-slate-100 px-1 rounded text-[10px]">
                                  {f.examinerCode}
                                </span>
                              )}
                              <span className="truncate">{f.examinerDesignation || 'Staff'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {f.approver ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] px-1.5 py-0">
                                Approver
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Evaluator
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteExisting(f.path_Id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="Remove examiner"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Helpful Tips Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              <span>Flow Path Routing Rules</span>
            </h4>
            <ul className="space-y-1 list-disc pl-4 text-slate-600">
              <li>Rank 1 is always the <strong>AI Examiner</strong> (automatically configured by the system).</li>
              <li>Human evaluators start from Rank 2 upwards.</li>
              <li>Multiple examiners can evaluate in tiers before final submission.</li>
              <li>At least one examiner should be designated as <strong>Authorized Final Approver</strong>.</li>
              <li>Examiners evaluate narrative answer papers mapped to this paper set.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
