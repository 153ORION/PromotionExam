import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle, XCircle, Settings, Layers, Hash } from 'lucide-react';
import { LookupType, LookupOverview } from '@/types';

export const LookupTypePage: React.FC = () => {
  const [types, setTypes] = useState<LookupType[]>([]);
  const [overview, setOverview] = useState<LookupOverview>({ total: 0, active: 0, inActive: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LookupType | null>(null);
  const [lookupTypeName, setLookupTypeName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTypes, resOverview] = await Promise.all([
        api.get('/lookups/types'),
        api.get('/lookups/types/overview')
      ]);
      setTypes(resTypes.data);
      setOverview(resOverview.data);
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
    setEditingType(null);
    setLookupTypeName('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (t: LookupType) => {
    setEditingType(t);
    setLookupTypeName(t.lookupType);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupTypeName.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/lookups/types', {
        typeId: editingType?.typeId,
        lookupType: lookupTypeName.trim()
      });
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save lookup type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.post(`/lookups/types/toggle/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lookup Types</h2>
          <p className="text-sm text-slate-500">Configure master categories for dropdown options across the application.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Add Lookup Type</span>
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Types</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{overview.total}</div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{overview.active}</div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Inactive</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{overview.inActive}</div>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Registered Lookup Types</CardTitle>
          <CardDescription>Manage types such as ExamYear, Company, Location, Department, Grade, etc.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Type Name</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Loading lookup types...
                  </TableCell>
                </TableRow>
              ) : types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No lookup types found.
                  </TableCell>
                </TableRow>
              ) : (
                types.map((t) => (
                  <TableRow key={t.typeId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{t.typeId}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{t.lookupType}</TableCell>
                    <TableCell className="text-slate-600">{t.serial || '-'}</TableCell>
                    <TableCell>
                      {t.isActive ? (
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
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(t)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={t.isActive ? 'destructive' : 'success'}
                        onClick={() => handleToggle(t.typeId)}
                      >
                        {t.isActive ? 'Deactivate' : 'Activate'}
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
          <DialogTitle>{editingType ? 'Edit Lookup Type' : 'Create New Lookup Type'}</DialogTitle>
          <DialogDescription>
            Enter the unique name for this lookup type category.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Type Name</label>
            <Input
              value={lookupTypeName}
              onChange={(e) => setLookupTypeName(e.target.value)}
              placeholder="e.g. Department, ExamYear, Location"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Saving...' : 'Save Lookup Type'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
