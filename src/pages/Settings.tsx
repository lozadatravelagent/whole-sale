import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Palette, 
  Save,
  Building,
  Phone,
  Mail,
  User
} from 'lucide-react';

const Settings = () => {
  const [branding, setBranding] = useState({
    logoUrl: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    contact: {
      name: 'Travel Agency Name',
      email: 'contact@agency.com',
      phone: '+1234567890'
    }
  });

  const handleSave = () => {
    // TODO: Save to Supabase agencies.branding
    console.log('Saving branding:', branding);
  };

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    setBranding(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactChange = (field: string, value: string) => {
    setBranding(prev => ({
      ...prev,
      contact: {
        ...prev.contact,
        [field]: value
      }
    }));
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Customize your agency branding and preferences</p>
          </div>
          <Button onClick={handleSave} className="bg-gradient-hero shadow-primary text-xs md:text-sm w-full md:w-auto">
            <Save className="h-3.5 md:h-4 w-3.5 md:w-4 mr-2" />
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="branding" className="text-xs md:text-sm">Branding</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs md:text-sm">Contact Info</TabsTrigger>
            <TabsTrigger value="account" className="text-xs md:text-sm">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Agency Branding</CardTitle>
                <CardDescription>
                  Customize your agency's appearance in quotes and communications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Agency Logo</Label>
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 bg-gradient-card rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                      {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <Building className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended size: 200x200px, PNG or JPG format
                  </p>
                </div>

                {/* Color Scheme */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-lg border"
                        style={{ backgroundColor: branding.primaryColor }}
                      />
                      <Input
                        id="primaryColor"
                        type="color"
                        value={branding.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={branding.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        placeholder="#3b82f6"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-lg border"
                        style={{ backgroundColor: branding.secondaryColor }}
                      />
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={branding.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={branding.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        placeholder="#1e40af"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="p-6 border rounded-lg space-y-4" style={{ 
                    background: `linear-gradient(135deg, ${branding.primaryColor}10, ${branding.secondaryColor}10)`,
                    borderColor: branding.primaryColor + '20'
                  }}>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-card rounded-lg flex items-center justify-center">
                        <Building className="h-6 w-6" style={{ color: branding.primaryColor }} />
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: branding.primaryColor }}>
                          {branding.contact.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">Travel Quote Preview</p>
                      </div>
                    </div>
                    <Button 
                      style={{ 
                        backgroundColor: branding.primaryColor,
                        borderColor: branding.primaryColor
                      }}
                      className="text-white"
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  This information will appear in your quotes and communications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agencyName">Agency Name</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="agencyName"
                      value={branding.contact.name}
                      onChange={(e) => handleContactChange('name', e.target.value)}
                      className="pl-10"
                      placeholder="Your Travel Agency"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={branding.contact.email}
                      onChange={(e) => handleContactChange('email', e.target.value)}
                      className="pl-10"
                      placeholder="contact@youragency.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={branding.contact.phone}
                      onChange={(e) => handleContactChange('phone', e.target.value)}
                      className="pl-10"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your account preferences and security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-card rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Account Type</p>
                      <p className="text-sm text-muted-foreground">Agency Administrator</p>
                    </div>
                  </div>
                  <Badge variant="default">ADMIN</Badge>
                </div>

                <div className="space-y-2">
                  <Label>Change Password</Label>
                  <Button variant="outline" className="w-full justify-start">
                    Update Password
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Two-Factor Authentication</Label>
                  <Button variant="outline" className="w-full justify-start">
                    Enable 2FA
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;