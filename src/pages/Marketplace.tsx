import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plane, 
  Building, 
  Car, 
  Ship, 
  CheckCircle,
  AlertCircle,
  Settings,
  ExternalLink
} from 'lucide-react';
import type { ProviderCode } from '@/types';

interface Provider {
  code: ProviderCode;
  name: string;
  description: string;
  icon: React.ElementType;
  status: 'active' | 'pending' | 'disabled';
  category: 'hotel' | 'flight' | 'package' | 'car' | 'cruise';
  requiresContract: boolean;
}

const Marketplace = () => {
  const [providers] = useState<Provider[]>([
    {
      code: 'EUROVIPS',
      name: 'Eurovips',
      description: 'Premium European hotel provider with SOAP integration',
      icon: Building,
      status: 'active',
      category: 'hotel',
      requiresContract: false,
    },
    {
      code: 'LOZADA',
      name: 'Lozada Travel',
      description: 'Complete travel packages and flight solutions',
      icon: Plane,
      status: 'pending',
      category: 'package',
      requiresContract: true,
    },
    {
      code: 'DELFOS',
      name: 'Delfos Hotels',
      description: 'Latin American hotel chain network',
      icon: Building,
      status: 'disabled',
      category: 'hotel',
      requiresContract: false,
    },
    {
      code: 'ICARO',
      name: 'Ícaro Flights',
      description: 'Regional flight aggregator with competitive rates',
      icon: Plane,
      status: 'active',
      category: 'flight',
      requiresContract: false,
    },
    {
      code: 'STARLING',
      name: 'Starling Cruises',
      description: 'Luxury cruise line bookings',
      icon: Ship,
      status: 'pending',
      category: 'cruise',
      requiresContract: true,
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'disabled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'pending': return AlertCircle;
      case 'disabled': return Settings;
      default: return AlertCircle;
    }
  };

  const handleActivateProvider = (provider: Provider) => {
    // TODO: Implement provider activation logic
    console.log('Activating provider:', provider.code);
  };

  const handleConfigureProvider = (provider: Provider) => {
    // TODO: Open configuration modal or redirect
    console.log('Configuring provider:', provider.code);
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
            <p className="text-muted-foreground mt-1">Connect with travel providers and expand your inventory</p>
          </div>
        </div>

        {/* Categories Filter */}
        <div className="flex items-center space-x-2">
          {['all', 'hotel', 'flight', 'package', 'car', 'cruise'].map((category) => (
            <Button key={category} variant="outline" size="sm" className="capitalize">
              {category}
            </Button>
          ))}
        </div>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => {
            const IconComponent = provider.icon;
            const StatusIcon = getStatusIcon(provider.status);
            
            return (
              <Card key={provider.code} className="shadow-card hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-card flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <Badge 
                          variant={getStatusColor(provider.status) as any}
                          className="text-xs mt-1"
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {provider.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <CardDescription className="text-sm">
                    {provider.description}
                  </CardDescription>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline" className="capitalize">
                      {provider.category}
                    </Badge>
                  </div>

                  {provider.requiresContract && (
                    <div className="flex items-center space-x-2 p-2 bg-warning/10 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      <span className="text-xs text-warning">Requires contract approval</span>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    {provider.status === 'active' ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleConfigureProvider(provider)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </>
                    ) : provider.status === 'pending' ? (
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        Pending Approval
                      </Button>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="flex-1 bg-gradient-hero shadow-primary" 
                            size="sm"
                          >
                            Activate
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Activate {provider.name}</DialogTitle>
                            <DialogDescription>
                              {provider.requiresContract 
                                ? 'This provider requires contract approval. We\'ll create a request for your wholesaler.'
                                : 'Enter your credentials to connect with this provider.'
                              }
                            </DialogDescription>
                          </DialogHeader>
                          
                          {!provider.requiresContract ? (
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="username">Username/API Key</Label>
                                <Input id="username" placeholder="Enter your credentials" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="password">Password/Secret</Label>
                                <Input id="password" type="password" placeholder="Enter your password" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="endpoint">Endpoint URL (optional)</Label>
                                <Input id="endpoint" placeholder="https://api.provider.com" />
                              </div>
                              <Button 
                                className="w-full bg-gradient-hero shadow-primary"
                                onClick={() => handleActivateProvider(provider)}
                              >
                                Test Connection & Activate
                              </Button>
                            </div>
                          ) : (
                            <div className="py-4 text-center space-y-4">
                              <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
                                <AlertCircle className="h-8 w-8 text-warning" />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Your request will be sent to your wholesaler for approval. 
                                You'll be notified once the contract is processed.
                              </p>
                              <Button 
                                className="w-full"
                                onClick={() => handleActivateProvider(provider)}
                              >
                                Request Activation
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Integration Status Summary */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Integration Summary</CardTitle>
            <CardDescription>Overview of your current provider connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-success/10 rounded-lg">
                <div className="text-2xl font-bold text-success">
                  {providers.filter(p => p.status === 'active').length}
                </div>
                <p className="text-sm text-muted-foreground">Active Integrations</p>
              </div>
              <div className="text-center p-4 bg-warning/10 rounded-lg">
                <div className="text-2xl font-bold text-warning">
                  {providers.filter(p => p.status === 'pending').length}
                </div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {providers.filter(p => p.status === 'disabled').length}
                </div>
                <p className="text-sm text-muted-foreground">Available to Activate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Marketplace;