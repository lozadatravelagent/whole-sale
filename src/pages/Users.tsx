import React, { useState } from 'react';
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
import { useAuthUser } from '@/hooks/useAuthUser';
import type { Role } from '@/types';

const Users = () => {
  const { user: currentUser, isOwner, isSuperAdmin, isAdmin } = useAuthUser();
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
      alert('Email y contraseña son requeridos');
      return;
    }

    setSaving(true);
    try {
      // Determine tenant_id based on role and user permissions
      let finalTenantId = null;
      if (isOwner && newTenantId && newTenantId !== 'none') {
        // OWNER can explicitly select tenant
        finalTenantId = newTenantId;
      } else {
        // Non-OWNER users inherit current user's tenant
        finalTenantId = currentUser?.tenant_id || null;
      }

      await createUser({
        email: newEmail,
        password: newPassword,
        name: newName || undefined,
        role: newRole,
        agency_id: newAgencyId && newAgencyId !== 'none' ? newAgencyId : null,
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
      if (isOwner && editTenantId && editTenantId !== 'none') {
        // OWNER can explicitly change tenant
        finalTenantId = editTenantId;
      } else if (isOwner && editTenantId === 'none') {
        // OWNER can set tenant to null
        finalTenantId = null;
      }
      // If not owner, don't update tenant_id (undefined means don't change)

      await updateUser({
        id: selectedUser.id,
        name: editName,
        role: editRole,
        agency_id: editAgencyId && editAgencyId !== 'none' ? editAgencyId : null,
        tenant_id: finalTenantId
      });

      setShowEditDialog(false);
      setSelectedUser(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    await deleteUser(userId);
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setEditName(user.name || '');
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
        return 'bg-purple-100 text-purple-800';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      case 'SELLER':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canManageUsers) {
    return (
      <MainLayout userRole={currentUser?.role || 'SELLER'}>
        <div className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tienes permisos para gestionar usuarios.
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
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Create and manage system users</p>
          </div>
          <div className="flex items-center gap-2">
            {(isOwner || isSuperAdmin) && agencies.length > 0 && (
              <Select value={filterAgency} onValueChange={setFilterAgency}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All agencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agencies</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-hero shadow-primary">
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Users List</CardTitle>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} visible
              {!isOwner && users.length > filteredUsers.length && (
                <span className="text-xs text-muted-foreground ml-2">
                  (OWNER users hidden)
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
                No users found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Agency</TableHead>
                      {isOwner && <TableHead>Tenant</TableHead>}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name || '-'}
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
                                title={user.role === 'OWNER' && !isOwner ? 'Solo OWNER puede editar usuarios OWNER' : 'Editar usuario'}
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
                                title="Eliminar usuario"
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
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email *</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password *</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role *</Label>
                <Select value={newRole} onValueChange={(val) => {
                  setNewRole(val as Role);
                  // Reset agency when SUPERADMIN is selected
                  if (val === 'SUPERADMIN') {
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
                {newRole === 'SUPERADMIN' && (
                  <p className="text-xs text-muted-foreground">
                    SUPERADMIN users belong to the tenant, not to a specific agency
                  </p>
                )}
              </div>
              {isOwner && newRole === 'SUPERADMIN' && (
                <div className="space-y-2">
                  <Label htmlFor="new-tenant">Tenant *</Label>
                  <Select value={newTenantId} onValueChange={setNewTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Tenant</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign SUPERADMIN to a tenant to manage its agencies and users
                  </p>
                </div>
              )}
              {newRole !== 'SUPERADMIN' && (
                <div className="space-y-2">
                  <Label htmlFor="new-agency">Agency {newRole === 'ADMIN' || newRole === 'SELLER' ? '*' : ''}</Label>
                  <Select value={newAgencyId} onValueChange={setNewAgencyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Agency</SelectItem>
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
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedUser?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editRole}
                  onValueChange={(val) => {
                    setEditRole(val as Role);
                    // Reset agency when SUPERADMIN is selected
                    if (val === 'SUPERADMIN') {
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
                    ⚠️ Solo usuarios con rol OWNER pueden cambiar el rol de otros OWNER
                  </p>
                )}
                {editRole === 'SUPERADMIN' && (
                  <p className="text-xs text-muted-foreground">
                    SUPERADMIN users belong to the tenant, not to a specific agency
                  </p>
                )}
              </div>
              {isOwner && editRole === 'SUPERADMIN' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-tenant">Tenant *</Label>
                  <Select value={editTenantId} onValueChange={setEditTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Tenant</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign SUPERADMIN to a tenant to manage its agencies and users
                  </p>
                </div>
              )}
              {editRole !== 'SUPERADMIN' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-agency">Agency {editRole === 'ADMIN' || editRole === 'SELLER' ? '*' : ''}</Label>
                  <Select value={editAgencyId} onValueChange={setEditAgencyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Agency</SelectItem>
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

export default Users;
