import React, { useState, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Upload,
  Palette,
  Save,
  Building,
  Phone,
  Mail,
  User,
  Loader2,
  AlertCircle,
  Lock,
  FileText,
  Code,
  Eye,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useAuthUser } from '@/hooks/useAuthUser';
import SimplePdfTemplateManager from '@/components/settings/SimplePdfTemplateManager';

const Settings = () => {
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller } = useAuthUser();
  const {
    agency,
    branding,
    profile,
    agencies,
    selectedAgencyId,
    loading,
    canEditAgencySettings,
    needsAgencySelector,
    setSelectedAgencyId,
    updateAgencyBranding,
    updateUserProfile,
    updatePassword,
    uploadLogo
  } = useSettings();

  // Local state for form editing
  const [editedBranding, setEditedBranding] = useState(branding);
  const [editedName, setEditedName] = useState(profile?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local state when data loads
  React.useEffect(() => {
    if (branding) {
      setEditedBranding(branding);
    }
  }, [branding]);

  React.useEffect(() => {
    if (profile?.name) {
      setEditedName(profile.name);
    }
  }, [profile?.name]);

  const handleSaveBranding = async () => {
    const targetAgencyId = selectedAgencyId || user?.agency_id;

    if (!targetAgencyId || !editedBranding) {
      return;
    }

    setSaving(true);
    try {
      await updateAgencyBranding({
        agency_id: targetAgencyId,
        branding: editedBranding
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ name: editedName });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      const success = await updatePassword(newPassword);
      if (success) {
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const targetAgencyId = selectedAgencyId || user?.agency_id;
    if (!targetAgencyId) {
      alert('No se pudo determinar la agencia');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen debe ser menor a 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const logoUrl = await uploadLogo(file, targetAgencyId);
      if (logoUrl && editedBranding) {
        setEditedBranding({
          ...editedBranding,
          logoUrl
        });
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    if (!editedBranding) return;
    setEditedBranding(prev => prev ? {
      ...prev,
      [field]: value
    } : prev);
  };

  const handleContactChange = (field: string, value: string) => {
    if (!editedBranding) return;
    setEditedBranding(prev => prev ? {
      ...prev,
      contact: {
        ...prev.contact,
        [field]: value
      }
    } : prev);
  };

  if (loading) {
    return (
      <MainLayout userRole={user?.role || 'ADMIN'}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole={user?.role || 'ADMIN'}>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuración</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {canEditAgencySettings
                ? 'Personaliza el branding y preferencias de tu agencia'
                : 'Gestiona la configuración de tu cuenta personal'}
            </p>
          </div>
        </div>

        {/* Permission alert for sellers */}
        {isSeller && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Como vendedor, solo puedes editar tu perfil personal. Para cambiar la configuración de la agencia, contacta a tu administrador.
            </AlertDescription>
          </Alert>
        )}

        {/* Agency Selector for OWNER and SUPERADMIN */}
        {needsAgencySelector && agencies.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Agencia</CardTitle>
              <CardDescription>
                {isOwner
                  ? 'Elige qué agencia quieres configurar'
                  : 'Elige una agencia de tu tenant'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedAgencyId || ''} onValueChange={setSelectedAgencyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una agencia..." />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                      {agency.tenant_name && ` (${agency.tenant_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={canEditAgencySettings ? "branding" : "account"} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger
              value="branding"
              className="text-xs md:text-sm"
              disabled={!canEditAgencySettings}
            >
              Branding
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              className="text-xs md:text-sm"
              disabled={!canEditAgencySettings}
            >
              Información de Contacto
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs md:text-sm">
              Cuenta
            </TabsTrigger>
          </TabsList>

          {/* BRANDING TAB */}
          <TabsContent value="branding" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Branding de la Agencia</CardTitle>
                    <CardDescription className="mt-2">
                      Personaliza la apariencia de tu agencia en cotizaciones y comunicaciones
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveBranding}
                    disabled={saving || !editedBranding}
                    className="bg-gradient-hero shadow-primary"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Guardar Cambios</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo de la Agencia</Label>
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 bg-gradient-card rounded-lg flex items-center justify-center border-2 border-dashed border-border overflow-hidden">
                      {editedBranding?.logoUrl ? (
                        <img src={editedBranding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Building className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Subir Logo</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tamaño recomendado: 200x200px, formato PNG o JPG (máx 2MB)
                  </p>
                </div>

                {/* Color Scheme */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Color Primario</Label>
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-lg border"
                        style={{ backgroundColor: editedBranding?.primaryColor || '#3b82f6' }}
                      />
                      <Input
                        id="primaryColor"
                        type="color"
                        value={editedBranding?.primaryColor || '#3b82f6'}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={editedBranding?.primaryColor || '#3b82f6'}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        placeholder="#3b82f6"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Color Secundario</Label>
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-lg border"
                        style={{ backgroundColor: editedBranding?.secondaryColor || '#1e40af' }}
                      />
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={editedBranding?.secondaryColor || '#1e40af'}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={editedBranding?.secondaryColor || '#1e40af'}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        placeholder="#1e40af"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Vista Previa</Label>
                  <div className="p-6 border rounded-lg space-y-4" style={{
                    background: `linear-gradient(135deg, ${editedBranding?.primaryColor || '#3b82f6'}10, ${editedBranding?.secondaryColor || '#1e40af'}10)`,
                    borderColor: (editedBranding?.primaryColor || '#3b82f6') + '20'
                  }}>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-card rounded-lg flex items-center justify-center">
                        {editedBranding?.logoUrl ? (
                          <img src={editedBranding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <Building className="h-6 w-6" style={{ color: editedBranding?.primaryColor || '#3b82f6' }} />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: editedBranding?.primaryColor || '#3b82f6' }}>
                          {editedBranding?.contact?.name || 'Tu Agencia'}
                        </h3>
                        <p className="text-sm text-muted-foreground">Vista Previa de Cotización</p>
                      </div>
                    </div>
                    <Button
                      style={{
                        backgroundColor: editedBranding?.primaryColor || '#3b82f6',
                        borderColor: editedBranding?.primaryColor || '#3b82f6'
                      }}
                      className="text-white"
                    >
                      Reservar Ahora
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF TEMPLATES SECTION */}
            {selectedAgencyId && agency ? (
              <SimplePdfTemplateManager
                agencyId={selectedAgencyId}
                agencyName={agency.name}
              />
            ) : (
              <Card className="shadow-card">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {needsAgencySelector
                      ? 'Por favor selecciona una agencia para gestionar las plantillas PDF'
                      : 'Cargando información de la agencia...'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CONTACT INFO TAB */}
          <TabsContent value="contact" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Información de Contacto</CardTitle>
                    <CardDescription>
                      Esta información aparecerá en tus cotizaciones y comunicaciones
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveBranding}
                    disabled={saving || !editedBranding}
                    className="bg-gradient-hero shadow-primary"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Guardar Cambios</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agencyName">Nombre de la Agencia</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="agencyName"
                      value={editedBranding?.contact?.name || ''}
                      onChange={(e) => handleContactChange('name', e.target.value)}
                      className="pl-10"
                      placeholder="Tu Agencia de Viajes"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email de Contacto</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={editedBranding?.contact?.email || ''}
                      onChange={(e) => handleContactChange('email', e.target.value)}
                      className="pl-10"
                      placeholder="contacto@tuagencia.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={editedBranding?.contact?.phone || ''}
                      onChange={(e) => handleContactChange('phone', e.target.value)}
                      className="pl-10"
                      placeholder="+34 123 456 789"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACCOUNT TAB */}
          <TabsContent value="account" className="space-y-6">
            {/* Role Badge */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Información de la Cuenta</CardTitle>
                <CardDescription>Tu rol y permisos en el sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-card rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{profile?.email || user?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {isOwner && 'Propietario de la Plataforma - Acceso a todos los tenants'}
                        {isSuperAdmin && 'Administrador de Tenant - Acceso a todas las agencias del tenant'}
                        {isAdmin && 'Administrador de Agencia - Gestiona tu agencia'}
                        {isSeller && 'Agente de Ventas - Gestiona leads asignados'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">
                    {profile?.role || user?.role}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Personal Profile */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Perfil Personal</CardTitle>
                    <CardDescription>Actualiza tu información personal</CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-gradient-hero shadow-primary"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Guardar Perfil</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">Nombre para Mostrar</Label>
                  <Input
                    id="userName"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Tu Nombre"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dirección de Email</Label>
                  <Input
                    value={profile?.email || user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    El email no se puede cambiar. Contacta a soporte si lo necesitas.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Cambiar Contraseña</CardTitle>
                <CardDescription>Actualiza tu contraseña por seguridad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Actualizando...</>
                  ) : (
                    <>Actualizar Contraseña</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;
