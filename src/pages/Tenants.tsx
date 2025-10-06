import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Users as UsersIcon,
  CheckCircle,
  XCircle,
  Power,
  Building
} from 'lucide-react';
import { useTenants } from '@/hooks/useTenants';
import { useAgencies } from '@/hooks/useAgencies';
import { useAuthUser } from '@/hooks/useAuthUser';

const Tenants = () => {
  const { user: currentUser, isOwner, isSuperAdmin } = useAuthUser();
  const {
    tenants,
    loading,
    canManageTenants,
    canViewTenants,
    createTenant,
    updateTenant,
    toggleTenantStatus,
    deleteTenant
  } = useTenants();

  const {
    agencies,
    updateAgency
  } = useAgencies();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAgenciesDialog, setShowAgenciesDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state for create
  const [newName, setNewName] = useState('');

  // Form state for edit
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!newName) {
      alert('Nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      await createTenant({
        name: newName
      });

      // Reset form
      setNewName('');
      setShowCreateDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTenant) return;

    setSaving(true);
    try {
      await updateTenant({
        id: selectedTenant.id,
        name: editName
      });

      setShowEditDialog(false);
      setSelectedTenant(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMessage = newStatus === 'suspended'
      ? '¿Suspender este tenant? Todas las agencias y usuarios bajo este tenant perderán acceso.'
      : '¿Activar este tenant?';

    if (!confirm(confirmMessage)) return;

    await toggleTenantStatus(tenantId, newStatus);
  };

  const handleDelete = async (tenantId: string) => {
    if (!confirm('¿Eliminar permanentemente este tenant? Esta acción no se puede deshacer. Asegúrate de que no tiene agencias ni usuarios asignados.')) {
      return;
    }

    await deleteTenant(tenantId);
  };

  const openEditDialog = (tenant: any) => {
    setSelectedTenant(tenant);
    setEditName(tenant.name || '');
    setShowEditDialog(true);
  };

  const openAgenciesDialog = (tenant: any) => {
    setSelectedTenant(tenant);
    setShowAgenciesDialog(true);
  };

  const handleAssignAgency = async (agencyId: string, tenantId: string | null) => {
    setSaving(true);
    try {
      await updateAgency({
        id: agencyId,
        tenant_id: tenantId
      });
    } finally {
      setSaving(false);
    }
  };

  const getAgenciesForTenant = (tenantId: string) => {
    return agencies.filter(a => a.tenant_id === tenantId);
  };

  const getUnassignedAgencies = () => {
    return agencies.filter(a => !a.tenant_id);
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

  if (!canViewTenants) {
    return (
      <MainLayout userRole={currentUser?.role || 'SELLER'}>
        <div className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tienes permisos para ver tenants.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole={currentUser?.role || 'OWNER'}>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tenant Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {isOwner ? 'Manage organizations (tenants) in the system' : 'View your organization'}
            </p>
          </div>
          {canManageTenants && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-hero shadow-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          )}
        </div>

        {/* Tenants Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Tenants List</CardTitle>
            <CardDescription>
              {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tenants found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agencies</TableHead>
                      <TableHead>Users</TableHead>
                      {canManageTenants && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {tenant.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(tenant.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-3 w-3 text-muted-foreground" />
                            {tenant.agencies_count || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UsersIcon className="h-3 w-3 text-muted-foreground" />
                            {tenant.users_count || 0}
                          </div>
                        </TableCell>
                        {canManageTenants && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAgenciesDialog(tenant)}
                                title="Manage Agencies"
                              >
                                <Building className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(tenant)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                                title={tenant.status === 'active' ? 'Suspend' : 'Activate'}
                              >
                                <Power className={tenant.status === 'active' ? 'h-4 w-4 text-orange-500' : 'h-4 w-4 text-green-500'} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(tenant.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Tenant Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Add a new organization to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Tenant Name *</Label>
                <Input
                  id="new-name"
                  placeholder="WholeSale Travel Group"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
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
                  'Create Tenant'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Tenant Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tenant</DialogTitle>
              <DialogDescription>
                Update tenant information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Tenant Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
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

        {/* Manage Tenant Agencies Dialog */}
        <Dialog open={showAgenciesDialog} onOpenChange={setShowAgenciesDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Agencies for {selectedTenant?.name}</DialogTitle>
              <DialogDescription>
                Assign or unassign agencies to this tenant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Assigned Agencies */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Assigned Agencies ({getAgenciesForTenant(selectedTenant?.id || '').length})</h3>
                {getAgenciesForTenant(selectedTenant?.id || '').length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agencies assigned to this tenant yet.</p>
                ) : (
                  <div className="space-y-2">
                    {getAgenciesForTenant(selectedTenant?.id || '').map((agency) => (
                      <div key={agency.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{agency.name}</span>
                          <Badge variant="outline">{agency.status}</Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignAgency(agency.id, null)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unassigned Agencies */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Available Agencies ({getUnassignedAgencies().length})</h3>
                {getUnassignedAgencies().length === 0 ? (
                  <p className="text-sm text-muted-foreground">All agencies are assigned to a tenant.</p>
                ) : (
                  <div className="space-y-2">
                    {getUnassignedAgencies().map((agency) => (
                      <div key={agency.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{agency.name}</span>
                          <Badge variant="outline">{agency.status}</Badge>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAssignAgency(agency.id, selectedTenant?.id)}
                          disabled={saving}
                        >
                          Assign
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowAgenciesDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Tenants;
