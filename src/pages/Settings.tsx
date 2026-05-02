import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import UnifiedLayout from '@/components/layouts/UnifiedLayout';
import { MeridianHeading, MeridianTag } from '@/components/meridian';
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
import { Textarea } from '@/components/ui/textarea';
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
import { useAuth } from '@/contexts/AuthContext';
import SimplePdfTemplateManager from '@/components/settings/SimplePdfTemplateManager';
import PdfTemplateManager from '@/components/settings/PdfTemplateManager';

const Settings = () => {
  const { t } = useTranslation('settings');
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller } = useAuth();
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
      alert(t('validation.passwordsMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      alert(t('validation.passwordTooShort'));
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
      alert(t('validation.noAgency'));
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert(t('validation.invalidImage'));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert(t('validation.imageTooLarge'));
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

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor' | 'pdfHeaderBgColor' | 'pdfFooterBgColor', value: string) => {
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
      <UnifiedLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <MeridianTag tone="lilac" className="mb-3">{t('tag')}</MeridianTag>
            <MeridianHeading as="h1" size="md" italic>{t('title')}</MeridianHeading>
            <p className="font-sans text-sm md:text-base font-light text-muted-foreground mt-2">
              {canEditAgencySettings
                ? t('subtitleAgency')
                : t('subtitlePersonal')}
            </p>
          </div>
        </div>

        {/* Permission alert for sellers */}
        {isSeller && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('sellerNotice')}
            </AlertDescription>
          </Alert>
        )}

        {/* Agency Selector for OWNER and SUPERADMIN */}
        {needsAgencySelector && agencies.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">{t('agencySelector.title')}</CardTitle>
              <CardDescription>
                {isOwner
                  ? t('agencySelector.descriptionOwner')
                  : t('agencySelector.descriptionAdmin')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedAgencyId || ''} onValueChange={setSelectedAgencyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('agencySelector.placeholder')} />
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
              {t('tabs.branding')}
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              className="text-xs md:text-sm"
              disabled={!canEditAgencySettings}
            >
              {t('tabs.contact')}
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs md:text-sm">
              {t('tabs.account')}
            </TabsTrigger>
          </TabsList>

          {/* BRANDING TAB */}
          <TabsContent value="branding" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('branding.title')}</CardTitle>
                    <CardDescription className="mt-2">
                      {t('branding.description')}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveBranding}
                    disabled={saving || !editedBranding}
                    className="bg-gradient-hero shadow-primary"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('branding.saving')}</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> {t('branding.save')}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>{t('branding.logo')}</Label>
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
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('branding.uploading')}</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> {t('branding.uploadLogo')}</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('branding.logoHint')}
                  </p>
                </div>

                {/* Color Scheme */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">{t('branding.primaryColor')}</Label>
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
                    <Label htmlFor="secondaryColor">{t('branding.secondaryColor')}</Label>
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

                {/* PDF Header/Footer Background Colors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="pdfHeaderBgColor">{t('branding.pdfHeaderBg')}</Label>
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-lg border"
                        style={{ backgroundColor: editedBranding?.pdfHeaderBgColor || 'transparent' }}
                      />
                      <Input
                        id="pdfHeaderBgColor"
                        type="color"
                        value={editedBranding?.pdfHeaderBgColor || '#ffffff'}
                        onChange={(e) => handleColorChange('pdfHeaderBgColor', e.target.value)}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={editedBranding?.pdfHeaderBgColor || ''}
                        onChange={(e) => handleColorChange('pdfHeaderBgColor', e.target.value)}
                        placeholder={t('branding.transparentPlaceholder')}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('branding.transparentHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pdfFooterBgColor">{t('branding.pdfFooterBg')}</Label>
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-lg border"
                        style={{ backgroundColor: editedBranding?.pdfFooterBgColor || 'transparent' }}
                      />
                      <Input
                        id="pdfFooterBgColor"
                        type="color"
                        value={editedBranding?.pdfFooterBgColor || '#ffffff'}
                        onChange={(e) => handleColorChange('pdfFooterBgColor', e.target.value)}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={editedBranding?.pdfFooterBgColor || ''}
                        onChange={(e) => handleColorChange('pdfFooterBgColor', e.target.value)}
                        placeholder={t('branding.transparentPlaceholder')}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('branding.transparentHint')}
                    </p>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label>{t('branding.preview')}</Label>
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
                          {editedBranding?.contact?.name || t('branding.previewAgency')}
                        </h3>
                        <p className="text-sm text-muted-foreground">{t('branding.previewQuote')}</p>
                      </div>
                    </div>
                    <Button
                      style={{
                        backgroundColor: editedBranding?.primaryColor || '#3b82f6',
                        borderColor: editedBranding?.primaryColor || '#3b82f6'
                      }}
                      className="text-white"
                    >
                      {t('branding.previewBookNow')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF TEMPLATES SECTION */}
            {selectedAgencyId && agency ? (
              agency.pdf_provider === 'pdfmonkey' ? (
                <PdfTemplateManager
                  agencyId={selectedAgencyId}
                  agencyName={agency.name}
                />
              ) : (
                <SimplePdfTemplateManager
                  agencyId={selectedAgencyId}
                  agencyName={agency.name}
                />
              )
            ) : (
              <Card className="shadow-card">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {needsAgencySelector
                      ? t('branding.selectAgencyForTemplates')
                      : t('branding.loadingAgency')}
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
                    <CardTitle>{t('contact.title')}</CardTitle>
                    <CardDescription>
                      {t('contact.description')}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveBranding}
                    disabled={saving || !editedBranding}
                    className="bg-gradient-hero shadow-primary"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('branding.saving')}</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> {t('branding.save')}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agencyName">{t('contact.agencyName')}</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="agencyName"
                      value={editedBranding?.contact?.name || ''}
                      onChange={(e) => handleContactChange('name', e.target.value)}
                      className="pl-10"
                      placeholder={t('contact.agencyNamePlaceholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('contact.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={editedBranding?.contact?.email || ''}
                      onChange={(e) => handleContactChange('email', e.target.value)}
                      className="pl-10"
                      placeholder={t('contact.emailPlaceholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('contact.phone')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={editedBranding?.contact?.phone || ''}
                      onChange={(e) => handleContactChange('phone', e.target.value)}
                      className="pl-10"
                      placeholder={t('contact.phonePlaceholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pdfFooterText">{t('contact.pdfFooter')}</Label>
                  <Textarea
                    id="pdfFooterText"
                    value={editedBranding?.pdfFooterText || ''}
                    onChange={(e) => {
                      if (!editedBranding) return;
                      setEditedBranding(prev => prev ? { ...prev, pdfFooterText: e.target.value } : prev);
                    }}
                    placeholder={t('contact.pdfFooterPlaceholder')}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('contact.pdfFooterHint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACCOUNT TAB */}
          <TabsContent value="account" className="space-y-6">
            {/* Role Badge */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>{t('account.title')}</CardTitle>
                <CardDescription>{t('account.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-card rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{profile?.email || user?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {isOwner && t('account.roles.owner')}
                        {isSuperAdmin && t('account.roles.superAdmin')}
                        {isAdmin && t('account.roles.admin')}
                        {isSeller && t('account.roles.seller')}
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
                    <CardTitle>{t('account.personalTitle')}</CardTitle>
                    <CardDescription>{t('account.personalDescription')}</CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-gradient-hero shadow-primary"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('branding.saving')}</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> {t('account.saveProfile')}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">{t('account.displayName')}</Label>
                  <Input
                    id="userName"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder={t('account.displayNamePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('account.emailLabel')}</Label>
                  <Input
                    value={profile?.email || user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('account.emailLocked')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>{t('account.passwordTitle')}</CardTitle>
                <CardDescription>{t('account.passwordDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('account.newPassword')}</Label>
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
                  <Label htmlFor="confirmPassword">{t('account.confirmPassword')}</Label>
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
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('account.updating')}</>
                  ) : (
                    <>{t('account.updatePassword')}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedLayout>
  );
};

export default Settings;
