import React, { useState, useEffect, useRef } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  AlertCircle,
  CheckCircle,
  Users,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import { ExamBatch, QuestionSet, ExamRegistration, LookupItem } from '@/types';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';

export const RegistrationPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [basicLookups, setBasicLookups] = useState<Record<string, any[]>>({});

  // Form selections
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [promotedGradeId, setPromotedGradeId] = useState<number | undefined>();

  // Employee search (searchable select)
  const [employeeOptions, setEmployeeOptions] = useState<SearchableSelectOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>();
  const [foundEmployee, setFoundEmployee] = useState<any | null>(null);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const searchDebounceRef = useRef<any>(null);

  // Submit status
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Batch Roster states
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterSetFilter, setRosterSetFilter] = useState<number>(0);
  const [rosterBatchId, setRosterBatchId] = useState<number>(0);
  const [rosterYearFilter, setRosterYearFilter] = useState<number>(0);
  const [examYears, setExamYears] = useState<{ value: number; label: string }[]>([]);

  // On mount: load batches, grades lookup
  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resLookups, resYears] = await Promise.all([
          api.get('/batches'),
          api.get('/lookups/basic'),
          api.get('/lookups/items', { params: { typeId: 1 } })
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        setBasicLookups(resLookups.data);
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

  // When form batch changes: load sets for that batch
  const handleBatchChange = async (batchId: number) => {
    setSelectedBatchId(batchId);
    setSelectedSetId(0);
    setSets([]);

    if (batchId <= 0) return;

    try {
      const resSets = await api.get('/questions/sets');
      const activeSets = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
      setSets(activeSets);
    } catch (err) {
      console.error(err);
    }
  };

  // Duplicate-active-registration validation:
  // if the selected employee already has an ACTIVE registration in the selected batch, block Save.
  useEffect(() => {
    setDuplicateError(null);
    if (!foundEmployee || selectedBatchId <= 0) return;

    let cancelled = false;
    const checkDuplicate = async () => {
      try {
        const res = await api.get('/registrations', { params: { batchId: selectedBatchId } });
        if (cancelled) return;
        const alreadyRegistered = (res.data || []).some(
          (r: ExamRegistration) => String(r.loginId) === String(foundEmployee.loginId) && r.isActive !== false
        );
        if (alreadyRegistered) {
          setDuplicateError(
            `${foundEmployee.name} (${foundEmployee.loginId}) is already registered in this exam batch. An employee cannot be registered twice in the same batch.`
          );
        }
      } catch (err) {
        // Ignore — backend re-validates on Save
      }
    };
    checkDuplicate();
    return () => {
      cancelled = true;
    };
  }, [foundEmployee, selectedBatchId]);

  // Employee searchable select: live search
  const handleEmployeeSearch = (term: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!term.trim()) return;

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setSearchingEmployees(true);
        const res = await api.get('/registrations/search-employee', { params: { query: term.trim() } });
        const emp = res.data;
        if (emp) {
          // Build a single result option: employee ID + name only
          setEmployeeOptions([{
            id: emp.hrRecordId,
            code: emp.loginId,
            title: emp.name
          }]);
        }
      } catch (err: any) {
        setEmployeeOptions([]);
      } finally {
        setSearchingEmployees(false);
      }
    }, 300);
  };

  const handleEmployeeSelect = async (opt: SearchableSelectOption | null) => {
    setSearchError(null);
    setFoundEmployee(null);
    if (!opt) {
      setSelectedEmployeeId(undefined);
      return;
    }
    setSelectedEmployeeId(Number(opt.id));

    // Fetch full employee details
    try {
      const res = await api.get('/registrations/search-employee', { params: { query: opt.code } });
      setFoundEmployee(res.data);
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Failed to load employee details.');
    }
  };

  const handleRegister = async () => {
    if (!foundEmployee || selectedBatchId <= 0 || selectedSetId <= 0) return;

    setSubmitting(true);
    setSuccessMessage(null);
    setSearchError(null);

    try {
      await api.post('/registrations', {
        loginId: foundEmployee.loginId,
        batchId: selectedBatchId,
        questionSetId: selectedSetId,
        promotedGradeId: promotedGradeId ? Number(promotedGradeId) : null
      });

      setSuccessMessage(`Candidate ${foundEmployee.name} (${foundEmployee.loginId}) successfully registered!`);
      setFoundEmployee(null);
      setSelectedEmployeeId(undefined);
      setEmployeeOptions([]);
      setSelectedBatchId(0);
      setSelectedSetId(0);
      setSets([]);
      setPromotedGradeId(undefined);

      // Refresh roster if a batch or year filter is active
      if (rosterBatchId > 0 || rosterYearFilter > 0) fetchRegistrations();
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Failed to register examinee.');
    } finally {
      setSubmitting(false);
    }
  };

  // Roster fetch (filter by batch, or by year across all batches)
  const fetchRegistrations = async (filters?: { batchId?: number; year?: number }) => {
    const fBatchId = filters?.batchId !== undefined ? filters.batchId : rosterBatchId;
    const fYear = filters?.year !== undefined ? filters.year : rosterYearFilter;
    if (fBatchId <= 0 && fYear <= 0) {
      setRegistrations([]);
      return;
    }
    setLoadingRegistrations(true);
    try {
      const res = await api.get('/registrations', {
        params: {
          batchId: fBatchId > 0 ? fBatchId : undefined,
          year: fBatchId <= 0 && fYear > 0 ? fYear : undefined,
        },
      });
      setRegistrations(res.data);
    } catch (err) {
      console.error('Failed to load batch registrations:', err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const handleRosterBatchChange = (batchId: number) => {
    setRosterBatchId(batchId);
    setRosterSetFilter(0);
    if (batchId > 0) fetchRegistrations({ batchId });
    else if (rosterYearFilter > 0) fetchRegistrations({ batchId: 0, year: rosterYearFilter });
    else setRegistrations([]);
  };

  const handleRosterYearChange = (year: number) => {
    setRosterYearFilter(year);
    setRosterBatchId(0);
    setRosterSetFilter(0);
    if (year > 0) fetchRegistrations({ batchId: 0, year });
    else setRegistrations([]);
  };

  const currentRosterBatch = batches.find((b) => b.batchId === rosterBatchId);

  // Question Set filter options for the roster are derived from the loaded
  // registrations, so only sets actually used in the selected batch are listed.
  const rosterSetOptions = Array.from(
    registrations.reduce((map, r) => {
      if (!map.has(r.questionSetId)) {
        map.set(r.questionSetId, r.setName || `Set #${r.questionSetId}`);
      }
      return map;
    }, new Map<number, string>())
  ).map(([id, name]) => ({ id, name }));

  const filteredRegistrations = registrations.filter((r) => {
    if (rosterSetFilter > 0 && r.questionSetId !== rosterSetFilter) return false;
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    return (
      r.loginId.toLowerCase().includes(q) ||
      r.examineeName.toLowerCase().includes(q) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(q)) ||
      (r.designation && r.designation.toLowerCase().includes(q)) ||
      (r.companyName && r.companyName.toLowerCase().includes(q)) ||
      (r.setName && r.setName.toLowerCase().includes(q)) ||
      (r.batchName && r.batchName.toLowerCase().includes(q))
    );
  });

  // Searchable options for batch / set / grade dropdowns
  // Batch: year + batch name only (no status)
  const batchOptions: SearchableSelectOption[] = batches.map((b) => ({
    id: b.batchId,
    code: String(b.examYear),
    title: b.examName
  }));

  // Question Set: set name + grade name only
  const setOptions: SearchableSelectOption[] = sets.map((s) => ({
    id: s.setId,
    title: s.setName,
    subtitle: s.gradeName || undefined
  }));

  const gradeOptions: SearchableSelectOption[] = (basicLookups['Grade'] || []).map((g) => ({
    id: g.lookupId,
    title: g.lookupText
  }));

  const canRegister = !!foundEmployee && selectedBatchId > 0 && selectedSetId > 0 && !duplicateError;

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Examinee Candidate Registration</h2>
        <p className="text-sm text-slate-500">Register employees into active exam batches and map appropriate question sets.</p>
      </div>

      {successMessage && (
        <div className="flex items-center space-x-2 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Search Employee by ID or Name — unified registration card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-600" />
            <span>Search Employee by ID or Name</span>
          </CardTitle>
          <CardDescription>
            Search and select an employee, then choose their exam batch, question set and promoted target grade to register.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Column 1: Examinee searchable select */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Examinee <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={employeeOptions}
                selectedId={selectedEmployeeId}
                onSelect={handleEmployeeSelect}
                placeholder="Search employee by ID or name..."
                searchPlaceholder="Type employee ID (e.g. 0100352) or name..."
                loading={searchingEmployees}
                onSearchChange={handleEmployeeSearch}
              />
            </div>

            {/* Column 2: Exam Batch */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Exam Batch <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={batchOptions}
                selectedId={selectedBatchId > 0 ? selectedBatchId : undefined}
                onSelect={(opt) => handleBatchChange(opt ? Number(opt.id) : 0)}
                placeholder="-- Select Batch --"
                searchPlaceholder="Search batch by name or year..."
              />
            </div>

            {/* Column 3: Question Set */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Question Set <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={setOptions}
                selectedId={selectedSetId > 0 ? selectedSetId : undefined}
                onSelect={(opt) => setSelectedSetId(opt ? Number(opt.id) : 0)}
                placeholder="-- Select Set --"
                searchPlaceholder="Search question set..."
                disabled={selectedBatchId <= 0}
              />
            </div>

            {/* Column 4: Promoted Target Grade */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Promoted Target Grade</label>
              <SearchableSelect
                options={gradeOptions}
                selectedId={promotedGradeId}
                onSelect={(opt) => setPromotedGradeId(opt ? Number(opt.id) : undefined)}
                placeholder="-- As Current Grade --"
                searchPlaceholder="Search grade..."
              />
            </div>
          </div>

          {/* Employee detail card (shown after selection) */}
          {foundEmployee && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{foundEmployee.name}</h4>
                  <div className="text-xs font-semibold text-blue-700">ID: {foundEmployee.loginId}</div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Verified Employee</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-500 block">Designation:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.designation || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Department:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.departmentName || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Company:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.companyName || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Current Grade:</span>
                  <span className="text-slate-900 font-medium">{foundEmployee.gradeName || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {(searchError || duplicateError) && (
            <div className="flex items-start space-x-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{duplicateError || searchError}</span>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              onClick={handleRegister}
              disabled={submitting || !canRegister}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2 min-w-[140px]"
            >
              <UserPlus className="h-4 w-4" />
              <span>{submitting ? 'Registering...' : 'Save'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Roster Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center space-x-2 text-slate-900">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Batch Registered Employees</span>
                {currentRosterBatch && (
                  <Badge variant="outline" className="ml-2 font-normal bg-blue-50 text-blue-700 border-blue-200">
                    {currentRosterBatch.examName} ({currentRosterBatch.examYear})
                  </Badge>
                )}
                {rosterBatchId <= 0 && rosterYearFilter > 0 && (
                  <Badge variant="outline" className="ml-2 font-normal bg-emerald-50 text-emerald-700 border-emerald-200">
                    Year: {rosterYearFilter} (All Batches)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                All active candidates enrolled in the selected exam batch, or across all batches of a selected year.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-semibold px-2.5 py-1">
                {registrations.length} {registrations.length === 1 ? 'Candidate' : 'Candidates'} Enrolled
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRegistrations()}
                disabled={loadingRegistrations || (rosterBatchId <= 0 && rosterYearFilter <= 0)}
                title="Refresh Roster"
                className="h-8 px-2.5 text-xs text-slate-600"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingRegistrations ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Roster Filter & Search Bar */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-200/60">
            {/* Roster year selector */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-sm font-semibold text-slate-700 shrink-0">Year:</span>
              <select
                value={rosterYearFilter}
                onChange={(e) => handleRosterYearChange(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm h-9 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-auto"
              >
                <option value={0}>-- All Years --</option>
                {examYears.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Roster batch selector (filtered by selected year) */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-sm font-semibold text-slate-700 shrink-0">Batch:</span>
              <select
                value={rosterBatchId}
                onChange={(e) => handleRosterBatchChange(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm h-9 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-auto"
              >
                <option value={0}>-- All Batches --</option>
                {batches
                  .filter((b) => rosterYearFilter <= 0 || b.examYear === rosterYearFilter)
                  .map((b) => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.examName} ({b.examYear})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <select
                value={rosterSetFilter}
                onChange={(e) => setRosterSetFilter(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm h-9 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-auto"
              >
                <option value="0">-- All Sets --</option>
                {rosterSetOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>


            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search by ID, name, designation, department..."
                className="pl-9 h-9 text-sm bg-white"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead>Designation & Dept</TableHead>
                  <TableHead>Company & Location</TableHead>
                  <TableHead>Exam Batch</TableHead>
                  <TableHead>Question Set Paper</TableHead>
                  <TableHead>Target Grade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosterBatchId <= 0 && rosterYearFilter <= 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-700">Select a Year or Batch to view the roster</p>
                          <p className="text-xs text-slate-500">Choose a year to see all examinees, or pick a specific exam batch.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : loadingRegistrations ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="text-sm">Loading registered candidates...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-700">
                            {rosterSearch.trim() || rosterSetFilter > 0
                              ? 'No candidates match the search filters'
                              : 'No candidates registered in this batch yet'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {rosterSearch.trim() || rosterSetFilter > 0
                              ? 'Try clearing the search text or set filter'
                              : 'Register employees above to add them to this batch roster.'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((r, index) => (
                    <TableRow key={r.examineeId} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-mono text-xs text-slate-400">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">
                        {r.loginId}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {r.examineeName}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{r.designation || '—'}</div>
                        <div className="text-slate-400">{r.departmentName || '—'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{r.companyName || '—'}</div>
                        <div className="text-slate-400">{r.locationName || '—'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {r.batchName || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                          {r.setName || 'Default Set'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {r.examGradeName || r.gradeName || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isExamEnd ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                            Completed
                          </Badge>
                        ) : r.isAttand ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                            Exam Started
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                            Enrolled
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
