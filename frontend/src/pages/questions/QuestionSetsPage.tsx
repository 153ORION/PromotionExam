import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle, XCircle, Layers, BookOpen, RefreshCw, X, Lightbulb, AlertTriangle } from 'lucide-react';
import { QuestionSet, SetSuggestion, SetSuggestions } from '@/types';
import { SyncSetQuestionsDialog } from '@/components/questions/SyncSetQuestionsDialog';
import { SetQuestionsDialog } from '@/components/questions/SetQuestionsDialog';

export const QuestionSetsPage: React.FC = () => {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [basicLookups, setBasicLookups] = useState<Record<string, any[]>>({});
  // Bank questions matching each set but not in it yet, keyed by setId (null until loaded).
  const [unsyncedCounts, setUnsyncedCounts] = useState<Record<number, number> | null>(null);
  // Bank combinations that no set has yet (null until loaded).
  const [suggestions, setSuggestions] = useState<SetSuggestions | null>(null);
  const [syncSet, setSyncSet] = useState<QuestionSet | null>(null);
  const [questionsSet, setQuestionsSet] = useState<QuestionSet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [setName, setSetName] = useState('');
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [gradeId, setGradeId] = useState<number | undefined>();
  const [locationId, setLocationId] = useState<number | undefined>();
  const [concentrationId, setConcentrationId] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Loaded on its own so a slow or failed count never holds up the list of sets.
  const fetchUnsyncedCounts = () => {
    api.get<Record<number, number>>('/questions/sets/unsynced-counts')
      .then((res) => setUnsyncedCounts(res.data))
      .catch((err) => console.error(err));
  };

  const fetchSuggestions = () => {
    api.get<SetSuggestions>('/questions/sets/suggestions')
      .then((res) => setSuggestions(res.data))
      .catch((err) => console.error(err));
  };

  const fetchData = async () => {
    fetchUnsyncedCounts();
    fetchSuggestions();
    setLoading(true);
    try {
      const [resSets, resLookups] = await Promise.all([
        api.get('/questions/sets', { params: { includeInactive: true } }),
        api.get('/lookups/basic')
      ]);
      setSets(resSets.data);
      setBasicLookups(resLookups.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingSet(null);
    setSetName('');
    setDepartmentId(undefined);
    setGradeId(undefined);
    setLocationId(undefined);
    setConcentrationId(undefined);
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: QuestionSet) => {
    setEditingSet(s);
    setSetName(s.setName);
    setDepartmentId(s.departmentId);
    setGradeId(s.gradeId);
    setLocationId(s.locationId);
    setConcentrationId(s.concentrationId);
    setDialogOpen(true);
  };

  // A new set filled in from a suggested combination; the name stays editable.
  const handleOpenSuggestion = (s: SetSuggestion) => {
    setEditingSet(null);
    setSetName(s.suggestedName);
    setDepartmentId(s.departmentId ?? undefined);
    setGradeId(s.gradeId ?? undefined);
    setLocationId(s.locationId ?? undefined);
    setConcentrationId(s.concentrationId ?? undefined);
    setDialogOpen(true);
  };

  // A suggestion field: its lookup name, the id if the lookup is gone, or "Any" when the bank leaves it empty.
  const suggestionField = (name?: string, id?: number) =>
    name || (id ? `#${id}` : <span className="text-slate-400">Any</span>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setName.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/questions/sets', {
        setId: editingSet?.setId,
        setName: setName.trim(),
        departmentId: departmentId ? Number(departmentId) : null,
        gradeId: gradeId ? Number(gradeId) : null,
        locationId: locationId ? Number(locationId) : null,
        concentrationId: concentrationId ? Number(concentrationId) : null,
      });
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save question set');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.post(`/questions/sets/toggle/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Question Sets</h2>
          <p className="text-sm text-slate-500">Create and configure question paper sets mapped to Location, Department, Grade, and Concentration.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Add Question Set</span>
        </Button>
      </div>

      {notice && (
        <div className="p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-start gap-2">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {suggestions && (suggestions.suggestions.length > 0 || suggestions.unmappedCount > 0) && (
        <Card className="border-amber-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" /> Suggested Question Sets
            </CardTitle>
            <CardDescription>
              Location, Department, Grade and Concentration combinations in the question bank that no question set has yet.
              Create the set, then use Sync to add its questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {suggestions.unmappedCount > 0 && (
              <div className="mx-6 mb-3 p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {suggestions.unmappedCount} question(s) are not counted because their Location, Department, Grade or
                  Concentration is not mapped yet.{' '}
                  <Link to="/question-bank/mapping" className="font-medium underline">Go to Lookup Mapping</Link>
                </span>
              </div>
            )}
            {suggestions.suggestions.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Suggested Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Concentration</TableHead>
                    <TableHead className="text-center" title="Valid questions that can be synced once the set exists">Questions</TableHead>
                    <TableHead className="text-center" title="Questions with errors or a disputed Type/Part, to fix in Fix Questions first">Needs Fixing</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.suggestions.map((s) => (
                    <TableRow key={`${s.locationId}-${s.departmentId}-${s.gradeId}-${s.concentrationId}`}>
                      <TableCell className="font-semibold text-slate-900">{s.suggestedName}</TableCell>
                      <TableCell className="text-sm text-slate-700">{suggestionField(s.locationName, s.locationId)}</TableCell>
                      <TableCell className="text-sm text-slate-700">{suggestionField(s.departmentName, s.departmentId)}</TableCell>
                      <TableCell className="text-sm text-slate-700">{suggestionField(s.gradeName, s.gradeId)}</TableCell>
                      <TableCell className="text-sm text-slate-700">{suggestionField(s.concentrationName, s.concentrationId)}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          {s.questionCount}
                        </span>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {s.mcqCount} MCQ · {s.descriptiveCount} Descriptive
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.needsFixingCount > 0 ? (
                          <Link to="/question-bank/fix" className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                            {s.needsFixingCount}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => handleOpenSuggestion(s)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Create Set
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Available Question Sets</CardTitle>
          <CardDescription>Question sets are used during candidate exam batch registration.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Set Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Concentration</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead className="text-center" title="Questions in the question bank that match this set but are not in it yet">Unsynced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    Loading question sets...
                  </TableCell>
                </TableRow>
              ) : sets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    No question sets created yet.
                  </TableCell>
                </TableRow>
              ) : (
                sets.map((s) => (
                  <TableRow key={s.setId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{s.setId}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{s.setName}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.locationName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.departmentName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.gradeName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.concentrationName || '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                        {s.questionCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {unsyncedCounts == null ? (
                        <span className="text-xs text-slate-400">…</span>
                      ) : (unsyncedCounts[s.setId] ?? 0) > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          {unsyncedCounts[s.setId]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <span className="inline-flex items-center text-xs text-emerald-700 font-medium">
                          <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-red-600 font-medium">
                          <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" /> Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setQuestionsSet(s)}>
                          <BookOpen className="h-3.5 w-3.5 mr-1" /> Questions
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSyncSet(s)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleOpenEdit(s)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={s.isActive ? 'destructive' : 'success'}
                          onClick={() => handleToggle(s.setId)}
                        >
                          {s.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingSet ? 'Edit Question Set' : 'Create New Question Set'}</DialogTitle>
          <DialogDescription>
            Configure the question set and associate with appropriate location, department, grade, and concentration.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Set Name</label>
            <Input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Electrical Engineering Promotion Exam Set A"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Location</label>
              <select
                value={locationId || ''}
                onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Any Location --</option>
                {basicLookups['Location']?.map((l) => (
                  <option key={l.lookupId} value={l.lookupId}>
                    {l.lookupText}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Department</label>
              <select
                value={departmentId || ''}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Any Department --</option>
                {basicLookups['Department']?.map((d) => (
                  <option key={d.lookupId} value={d.lookupId}>
                    {d.lookupText}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Grade</label>
              <select
                value={gradeId || ''}
                onChange={(e) => setGradeId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Any Grade --</option>
                {basicLookups['Grade']?.map((g) => (
                  <option key={g.lookupId} value={g.lookupId}>
                    {g.lookupText}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Concentration</label>
              <select
                value={concentrationId || ''}
                onChange={(e) => setConcentrationId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Any Concentration --</option>
                {basicLookups['Concentration']?.map((c) => (
                  <option key={c.lookupId} value={c.lookupId}>
                    {c.lookupText}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Saving...' : 'Save Question Set'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {syncSet && (
        <SyncSetQuestionsDialog
          set={syncSet}
          onClose={() => setSyncSet(null)}
          onSynced={(res) => { setNotice(res.message); fetchData(); }}
        />
      )}

      {questionsSet && (
        <SetQuestionsDialog set={questionsSet} onClose={() => setQuestionsSet(null)} />
      )}
    </div>
  );
};
