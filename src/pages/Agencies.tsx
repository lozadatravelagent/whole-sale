import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Users as UsersIcon,
  Phone,
  CheckCircle,
  XCircle,
  Power,
  BarChart3,
  TrendingUp,
  MessageCircle
} from 'lucide-react';
import { useAgencies } from '@/hooks/useAgencies';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const Agencies = () => {
  const { user: currentUser, isOwner, isSuperAdmin } = useAuth();
  const {
    agencies,
    tenants,
    loading,
    canManageAgencies,
    canCreateAgencies,
    canDeleteAgencies,
    createAgency,
    updateAgency,
    toggleAgencyStatus,
    deleteAgency
  } = useAgencies();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state for create
  const [newTenantId, setNewTenantId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhones, setNewPhones] = useState('');

  // Form state for edit
  const [editName, setEditName] = useState('');
  const [editPhones, setEditPhones] = useState('');

  // Agency metrics
  const [agencyMetrics, setAgencyMetrics] = useState<Record<string, {
    users_count: number;
    leads_count: number;
    active_conversations: number;
  }>>({});

  // Load metrics for all agencies
  useEffect(() => {
    const loadMetrics = async () => {
      if (agencies.length === 0) return;

      const metrics: Record<string, any> = {};

      await Promise.all(
        agencies.map(async (agency) => {
          // Count users
          const { count: usersCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', agency.id);

          // Count leads
          const { count: leadsCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', agency.id);

          // Count active conversations
          const { count: conversationsCount } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', agency.id)
            .eq('state', 'active');

          metrics[agency.id] = {
            users_count: usersCount || 0,
            leads_count: leadsCount || 0,
            active_conversations: conversationsCount || 0
          };
        })
      );

      setAgencyMetrics(metrics);
    };

    loadMetrics();
  }, [agencies]);

  const handleCreate = async () => {
    if (!newTenantId || !newName) {
      alert('Tenant y nombre son requeridos');
      return;
    }

    setSaving(true);
    try {
      const phonesArray = newPhones
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      await createAgency({
        tenant_id: newTenantId,
        name: newName,
        phones: phonesArray.length > 0 ? phonesArray : undefined
      });

      // Reset form
      setNewTenantId('');
      setNewName('');
      setNewPhones('');
      setShowCreateDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedAgency) return;

    setSaving(true);
    try {
      const phonesArray = editPhones
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      await updateAgency({
        id: selectedAgency.id,
        name: editName,
        phones: phonesArray.length > 0 ? phonesArray : []
      });

      setShowEditDialog(false);
      setSelectedAgency(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (agencyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMessage = newStatus === 'suspended'
      ? '¿Suspender esta agencia? Los usuarios no podrán acceder.'
      : '¿Activar esta agencia?';

    if (!confirm(confirmMessage)) return;

    await toggleAgencyStatus(agencyId, newStatus);
  };

  const handleDelete = async (agencyId: string) => {
    if (!confirm('¿Eliminar permanentemente esta agencia? Esta acción no se puede deshacer. Asegúrate de que no tiene usuarios ni leads asignados.')) {
      return;
    }

    await deleteAgency(agencyId);
  };

  const openEditDialog = (agency: any) => {
    setSelectedAgency(agency);
    setEditName(agency.name || '');
    setEditPhones(agency.phones?.join(', ') || '');
    setShowEditDialog(true);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Suspended
      </Badge>
    );
  };

  if (!canManageAgencies) {
    return (
      <MainLayout userRole={currentUser?.role || 'SELLER'}>
        <div className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tienes permisos para gestionar agencias.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole={currentUser?.role || 'ADMIN'}>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Agency Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Create and manage agencies
            </p>
          </div>
          {canCreateAgencies && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-hero shadow-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Agency
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agencies</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agencies.length}</div>
              <p className="text-xs text-muted-foreground">
                {agencies.filter(a => a.status === 'active').length} active
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <UsersIcon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(agencyMetrics).reduce((sum, m) => sum + m.users_count, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all agencies
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(agencyMetrics).reduce((sum, m) => sum + m.leads_count, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all agencies
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Agencies Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Agencies List</CardTitle>
            <CardDescription>
              {agencies.length} agenc{agencies.length !== 1 ? 'ies' : 'y'} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : agencies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No agencies found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {isOwner && <TableHead>Tenant</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Users</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="text-center">Active Chats</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencies.map((agency) => {
                      const metrics = agencyMetrics[agency.id];
                      return (
                        <TableRow key={agency.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              {agency.name}
                            </div>
                          </TableCell>
                          {isOwner && (
                            <TableCell>{agency.tenant_name || '-'}</TableCell>
                          )}
                          <TableCell>
                            {getStatusBadge(agency.status)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <UsersIcon className="h-3 w-3 text-blue-500" />
                              <span className="font-semibold">{metrics?.users_count || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <BarChart3 className="h-3 w-3 text-purple-500" />
                              <span className="font-semibold">{metrics?.leads_count || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              <span className="font-semibold">{metrics?.active_conversations || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-3 w-3 text-green-600" />
                              {agency.phones?.length > 0 ? agency.phones.join(', ') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(agency)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(agency.id, agency.status)}
                                title={agency.status === 'active' ? 'Suspend' : 'Activate'}
                              >
                                <Power className={agency.status === 'active' ? 'h-4 w-4 text-orange-500' : 'h-4 w-4 text-green-500'} />
                              </Button>
                              {canDeleteAgencies && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(agency.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Agency Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agency</DialogTitle>
              <DialogDescription>
                Add a new agency to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-tenant">Tenant *</Label>
                <Select value={newTenantId} onValueChange={setNewTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Agency Name *</Label>
                <Input
                  id="new-name"
                  placeholder="My Travel Agency"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-phones">Phones (comma-separated)</Label>
                <Input
                  id="new-phones"
                  placeholder="+1234567890, +0987654321"
                  value={newPhones}
                  onChange={(e) => setNewPhones(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple phone numbers with commas
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  'Create Agency'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Agency Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Agency</DialogTitle>
              <DialogDescription>
                Update agency information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Input value={selectedAgency?.tenant_name || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Tenant cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Agency Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phones">Phones (comma-separated)</Label>
                <Input
                  id="edit-phones"
                  placeholder="+1234567890, +0987654321"
                  value={editPhones}
                  onChange={(e) => setEditPhones(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple phone numbers with commas
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Agencies;
