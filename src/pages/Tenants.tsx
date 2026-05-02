import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import UnifiedLayout from '@/components/layouts/UnifiedLayout';
import { MeridianHeading, MeridianTag } from '@/components/meridian';
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
import { useAuth } from '@/contexts/AuthContext';

const Tenants = () => {
  const { t } = useTranslation('admin');
  const { user: currentUser, isOwner, isSuperAdmin } = useAuth();
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
      alert(t('tenants.validation.nameRequired'));
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
      ? t('tenants.confirm.suspend')
      : t('tenants.confirm.activate');

    if (!confirm(confirmMessage)) return;

    await toggleTenantStatus(tenantId, newStatus);
  };

  const handleDelete = async (tenantId: string) => {
    if (!confirm(t('tenants.confirm.delete'))) {
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
          {t('common.active')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        {t('common.suspended')}
      </Badge>
    );
  };

  if (!canViewTenants) {
    return (
      <UnifiedLayout>
        <div className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('tenants.noPermissions')}
            </AlertDescription>
          </Alert>
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <MeridianTag tone="lilac" className="mb-3">{t('tenants.tag')}</MeridianTag>
            <MeridianHeading as="h1" size="md" italic>{t('tenants.title')}</MeridianHeading>
            <p className="font-sans text-sm md:text-base font-light text-muted-foreground mt-2">
              {isOwner ? t('tenants.subtitleOwner') : t('tenants.subtitleScoped')}
            </p>
          </div>
          {canManageTenants && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-hero shadow-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('tenants.createButton')}
            </Button>
          )}
        </div>

        {/* Tenants Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{t('tenants.listTitle')}</CardTitle>
            <CardDescription>
              {t('tenants.listCount', { count: tenants.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('tenants.empty')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tenants.table.name')}</TableHead>
                      <TableHead>{t('tenants.table.status')}</TableHead>
                      <TableHead>{t('tenants.table.agencies')}</TableHead>
                      <TableHead>{t('tenants.table.users')}</TableHead>
                      {canManageTenants && <TableHead className="text-right">{t('tenants.table.actions')}</TableHead>}
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
                                title={t('tenants.tooltips.manageAgencies')}
                              >
                                <Building className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(tenant)}
                                title={t('common.edit')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                                title={tenant.status === 'active' ? t('common.suspend') : t('common.activate')}
                              >
                                <Power className={tenant.status === 'active' ? 'h-4 w-4 text-orange-500' : 'h-4 w-4 text-green-500'} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(tenant.id)}
                                title={t('common.delete')}
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
              <DialogTitle>{t('tenants.createDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('tenants.createDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">{t('tenants.createDialog.nameLabel')}</Label>
                <Input
                  id="new-name"
                  placeholder={t('tenants.createDialog.namePlaceholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('common.creating')}</>
                ) : (
                  t('tenants.createDialog.submit')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Tenant Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tenants.editDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('tenants.editDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('tenants.editDialog.nameLabel')}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('common.saving')}</>
                ) : (
                  t('common.save')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Tenant Agencies Dialog */}
        <Dialog open={showAgenciesDialog} onOpenChange={setShowAgenciesDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('tenants.agenciesDialog.title', { name: selectedTenant?.name })}</DialogTitle>
              <DialogDescription>
                {t('tenants.agenciesDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Assigned Agencies */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">{t('tenants.agenciesDialog.assignedTitle', { count: getAgenciesForTenant(selectedTenant?.id || '').length })}</h3>
                {getAgenciesForTenant(selectedTenant?.id || '').length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('tenants.agenciesDialog.assignedEmpty')}</p>
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
                          {t('common.remove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unassigned Agencies */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">{t('tenants.agenciesDialog.availableTitle', { count: getUnassignedAgencies().length })}</h3>
                {getUnassignedAgencies().length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('tenants.agenciesDialog.availableEmpty')}</p>
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
                          {t('common.assign')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowAgenciesDialog(false)}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedLayout>
  );
};

export default Tenants;
