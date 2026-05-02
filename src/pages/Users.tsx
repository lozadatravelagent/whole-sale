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
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Shield,
  Building,
  Mail
} from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useAgencies } from '@/hooks/useAgencies';
import { useTenants } from '@/hooks/useTenants';
import { useAuth } from '@/contexts/AuthContext';
import type { Role } from '@/types';

const Users = () => {
  const { t } = useTranslation('admin');
  const { user: currentUser, isOwner, isSuperAdmin, isAdmin } = useAuth();
  const {
    users,
    loading,
    allowedRoles,
    canManageUsers,
    createUser,
    updateUser,
    deleteUser
  } = useUsers();

  const { agencies } = useAgencies();
  const { tenants } = useTenants();
  // Agency filter (for OWNER / SUPERADMIN)
  const [filterAgency, setFilterAgency] = useState<string>('all');


  // BUSINESS RULE: Filter OWNER users - only OWNER can see other OWNERs
  const visibleUsers = React.useMemo(() => {
    if (isOwner) return users; // OWNER sees all users
    return users.filter(u => u.role !== 'OWNER'); // Others don't see OWNER users
  }, [users, isOwner]);

  const filteredUsers = React.useMemo(() => {
    // OWNER/SUPERADMIN can filter by agency
    if ((isOwner || isSuperAdmin) && filterAgency !== 'all') {
      return visibleUsers.filter(u => u.agency_id === filterAgency);
    }
    // ADMIN sees only their agency via hook; keep visibleUsers
    return visibleUsers;
  }, [visibleUsers, isOwner, isSuperAdmin, filterAgency]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state for create
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('SELLER');
  const [newAgencyId, setNewAgencyId] = useState('');
  const [newTenantId, setNewTenantId] = useState('');

  // Form state for edit
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('SELLER');
  const [editAgencyId, setEditAgencyId] = useState('');
  const [editTenantId, setEditTenantId] = useState('');

  const handleCreate = async () => {
    if (!newEmail || !newPassword) {
      alert(t('users.validation.emailPasswordRequired'));
      return;
    }

    setSaving(true);
    try {
      // Determine tenant_id based on role and user permissions
      let finalTenantId = null;
      if (isOwner) {
        // OWNER can explicitly select tenant for any role
        if (newTenantId && newTenantId !== 'none') {
          finalTenantId = newTenantId;
        } else {
          // OWNER can set tenant to null (when 'none' selected or empty)
          finalTenantId = null;
        }
      } else {
        // Non-OWNER users inherit current user's tenant
        finalTenantId = currentUser?.tenant_id || null;
      }

      await createUser({
        email: newEmail,
        password: newPassword,
        name: newName || undefined,
        role: newRole,
        agency_id: (newRole === 'OWNER' || newRole === 'SUPERADMIN') ? null : (newAgencyId && newAgencyId !== 'none' ? newAgencyId : null),
        tenant_id: finalTenantId
      });

      // Reset form
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('SELLER');
      setNewAgencyId('');
      setNewTenantId('');
      setShowCreateDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      // Determine tenant_id based on role and user permissions
      let finalTenantId = undefined;
      if (isOwner) {
        // OWNER can explicitly change tenant for any role
        if (editTenantId && editTenantId !== 'none') {
          finalTenantId = editTenantId;
        } else if (editTenantId === 'none') {
          // OWNER can set tenant to null
          finalTenantId = null;
        }
      }
      // If not owner, don't update tenant_id (undefined means don't change)

      await updateUser({
        id: selectedUser.id,
        name: editName,
        role: editRole,
        agency_id: (editRole === 'OWNER' || editRole === 'SUPERADMIN') ? null : (editAgencyId && editAgencyId !== 'none' ? editAgencyId : null),
        tenant_id: finalTenantId
      });

      setShowEditDialog(false);
      setSelectedUser(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t('users.confirm.delete'))) {
      return;
    }

    await deleteUser(userId);
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setEditName(user.email.split('@')[0] || '');
    setEditRole(user.role);
    setEditAgencyId(user.agency_id || 'none');
    setEditTenantId(user.tenant_id || 'none');
    setShowEditDialog(true);
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'OWNER':
        return 'bg-red-100 text-red-800';
      case 'SUPERADMIN':
        return 'bg-primary/15 text-primary';
      case 'ADMIN':
        return 'bg-accent/15 text-accent';
      case 'SELLER':
        return 'bg-success/15 text-success';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (!canManageUsers) {
    return (
      <UnifiedLayout>
        <div className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('users.noPermissions')}
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
            <MeridianTag tone="lilac" className="mb-3">{t('users.tag')}</MeridianTag>
            <MeridianHeading as="h1" size="md" italic>{t('users.title')}</MeridianHeading>
            <p className="font-sans text-sm md:text-base font-light text-muted-foreground mt-2">{t('users.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {(isOwner || isSuperAdmin) && agencies.length > 0 && (
              <Select value={filterAgency} onValueChange={setFilterAgency}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={t('users.filterAll')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('users.filterAll')}</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-hero shadow-primary">
              <UserPlus className="h-4 w-4 mr-2" />
              {t('users.createButton')}
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{t('users.listTitle')}</CardTitle>
            <CardDescription>
              {t('users.listCount', { count: filteredUsers.length })}
              {!isOwner && users.length > filteredUsers.length && (
                <span className="text-xs text-muted-foreground ml-2">
                  {t('users.ownerHidden')}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('users.empty')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('users.table.name')}</TableHead>
                      <TableHead>{t('users.table.email')}</TableHead>
                      <TableHead>{t('users.table.role')}</TableHead>
                      <TableHead>{t('users.table.agency')}</TableHead>
                      {isOwner && <TableHead>{t('users.table.tenant')}</TableHead>}
                      <TableHead className="text-right">{t('users.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.email.split('@')[0]}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            <Shield className="h-3 w-3 mr-1" />
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-3 w-3 text-muted-foreground" />
                            {user.agency_name || '-'}
                          </div>
                        </TableCell>
                        {isOwner && (
                          <TableCell>{user.tenant_name || '-'}</TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* BUSINESS RULE: Only OWNER can edit OWNER users */}
                            {(isOwner || user.role !== 'OWNER') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(user)}
                                title={user.role === 'OWNER' && !isOwner ? t('users.tooltips.ownerOnly') : t('users.tooltips.edit')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {/* BUSINESS RULE: Only OWNER can delete, but not themselves or other OWNERs */}
                            {isOwner && user.id !== currentUser?.id && user.role !== 'OWNER' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                                title={t('users.tooltips.delete')}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.createDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('users.createDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">{t('users.createDialog.emailLabel')}</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder={t('users.createDialog.emailPlaceholder')}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('users.createDialog.passwordLabel')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">{t('users.createDialog.nameLabel')}</Label>
                <Input
                  id="new-name"
                  placeholder={t('users.createDialog.namePlaceholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">{t('users.createDialog.roleLabel')}</Label>
                <Select value={newRole} onValueChange={(val) => {
                  setNewRole(val as Role);
                  // Reset agency when SUPERADMIN or OWNER is selected
                  if (val === 'SUPERADMIN' || val === 'OWNER') {
                    setNewAgencyId('');
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(newRole === 'SUPERADMIN' || newRole === 'OWNER') && (
                  <p className="text-xs text-muted-foreground">
                    {newRole === 'SUPERADMIN'
                      ? t('users.createDialog.superAdminHint')
                      : t('users.createDialog.ownerHint')}
                  </p>
                )}
              </div>
              {isOwner && (newRole === 'SUPERADMIN' || newRole === 'OWNER') && (
                <div className="space-y-2">
                  <Label htmlFor="new-tenant">{t('users.createDialog.tenantLabel')} {newRole === 'SUPERADMIN' ? t('users.createDialog.tenantRequired') : ''}</Label>
                  <Select value={newTenantId} onValueChange={setNewTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.createDialog.tenantPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('users.createDialog.noTenant')}</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {newRole === 'SUPERADMIN'
                      ? t('users.createDialog.superAdminTenantHint')
                      : t('users.createDialog.ownerTenantHint')}
                  </p>
                </div>
              )}
              {newRole !== 'SUPERADMIN' && newRole !== 'OWNER' && (
                <div className="space-y-2">
                  <Label htmlFor="new-agency">{t('users.createDialog.agencyLabel')} {newRole === 'ADMIN' || newRole === 'SELLER' ? t('users.createDialog.agencyRequired') : ''}</Label>
                  <Select value={newAgencyId} onValueChange={setNewAgencyId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.createDialog.agencyPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('users.createDialog.noAgency')}</SelectItem>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('common.creating')}</>
                ) : (
                  t('users.createDialog.submit')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.editDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('users.editDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('users.table.email')}</Label>
                <Input value={selectedUser?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">{t('users.editDialog.emailLocked')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('users.createDialog.nameLabel')}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">{t('users.table.role')}</Label>
                <Select
                  value={editRole}
                  onValueChange={(val) => {
                    setEditRole(val as Role);
                    // Reset agency when SUPERADMIN or OWNER is selected
                    if (val === 'SUPERADMIN' || val === 'OWNER') {
                      setEditAgencyId('');
                    }
                  }}
                  disabled={selectedUser?.role === 'OWNER' && !isOwner}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedUser?.role === 'OWNER' && !isOwner && (
                  <p className="text-xs text-destructive">
                    {t('users.editDialog.ownerOnlyWarning')}
                  </p>
                )}
                {(editRole === 'SUPERADMIN' || editRole === 'OWNER') && (
                  <p className="text-xs text-muted-foreground">
                    {editRole === 'SUPERADMIN'
                      ? t('users.createDialog.superAdminHint')
                      : t('users.createDialog.ownerHint')}
                  </p>
                )}
              </div>
              {isOwner && (editRole === 'SUPERADMIN' || editRole === 'OWNER') && (
                <div className="space-y-2">
                  <Label htmlFor="edit-tenant">{t('users.createDialog.tenantLabel')} {editRole === 'SUPERADMIN' ? t('users.createDialog.tenantRequired') : ''}</Label>
                  <Select value={editTenantId} onValueChange={setEditTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.createDialog.tenantPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('users.createDialog.noTenant')}</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editRole === 'SUPERADMIN'
                      ? t('users.createDialog.superAdminTenantHint')
                      : t('users.createDialog.ownerTenantHint')}
                  </p>
                </div>
              )}
              {editRole !== 'SUPERADMIN' && editRole !== 'OWNER' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-agency">{t('users.createDialog.agencyLabel')} {editRole === 'ADMIN' || editRole === 'SELLER' ? t('users.createDialog.agencyRequired') : ''}</Label>
                  <Select value={editAgencyId} onValueChange={setEditAgencyId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.createDialog.agencyPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('users.createDialog.noAgency')}</SelectItem>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
      </div>
    </UnifiedLayout>
  );
};

export default Users;
