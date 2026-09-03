import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle, XCircle, Layers, BookOpen } from 'lucide-react';
import { QuestionSet } from '@/types';

export const QuestionSetsPage: React.FC = () => {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [basicLookups, setBasicLookups] = useState<Record<string, any[]>>({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [setName, setSetName] = useState('');
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [gradeId, setGradeId] = useState<number | undefined>();
  const [locationId, setLocationId] = useState<number | undefined>();
  const [concentrationId, setConcentrationId] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSets, resLookups] = await Promise.all([
        api.get('/questions/sets'),
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
          <p className="text-sm text-slate-500">Create and configure question paper sets mapped to Department, Grade, and Concentration.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Add Question Set</span>
        </Button>
      </div>

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
                <TableHead>Department</TableHead>
                <TableHead>Target Grade</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Concentration</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    Loading question sets...
                  </TableCell>
                </TableRow>
              ) : sets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    No question sets created yet.
                  </TableCell>
                </TableRow>
              ) : (
                sets.map((s) => (
                  <TableRow key={s.setId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{s.setId}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{s.setName}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.departmentName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.gradeName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.locationName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{s.concentrationName || '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                        {s.questionCount}
                      </span>
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
                    <TableCell className="text-right space-x-2">
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
            Configure the question set and associate with appropriate department and grade.
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
              <label className="text-sm font-medium text-slate-700">Target Grade</label>
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
    </div>
  );
};
