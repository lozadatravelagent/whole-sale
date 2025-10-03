import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, ArrowRight, MessageSquare, Users, Store } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: Check if user is authenticated with Supabase
    // For now, redirect to login
    const isAuthenticated = false; // Replace with actual auth check

    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleGetStarted = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative">
        <div className="container mx-auto px-4 pt-12 md:pt-20 pb-12 md:pb-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center mb-6 md:mb-8">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-hero rounded-2xl flex items-center justify-center shadow-primary">
                <Plane className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 md:mb-6">
              <span className="bg-clip-text text-transparent">
                VIBOOK
              </span>
              <br />
              Travel SaaS Platform
            </h1>

            <p className="text-base md:text-lg lg:text-xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto px-4">
              Streamline your travel agency operations with AI-powered chat, CRM,
              and multi-provider integrations. Built for wholesalers and agencies.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4">
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-gradient-hero hover:opacity-90 shadow-primary text-base md:text-lg px-6 md:px-8 w-full sm:w-auto"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 md:h-5 w-4 md:w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base md:text-lg px-6 md:px-8 w-full sm:w-auto">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 md:py-16 bg-gradient-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">Everything you need to manage travel</h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              From WhatsApp conversations to CRM and provider integrations,
              VIBOOK handles it all in one unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <Card className="shadow-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI-Powered Chat</CardTitle>
                <CardDescription>
                  Handle customer inquiries across WhatsApp and web with intelligent automation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Multi-channel support</li>
                  <li>• Automated quote generation</li>
                  <li>• Real-time responses</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Advanced CRM</CardTitle>
                <CardDescription>
                  Track leads from first contact to booking with comprehensive management tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Kanban pipeline</li>
                  <li>• Lead scoring</li>
                  <li>• Conversion tracking</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-4">
                  <Store className="h-6 w-6 text-warning" />
                </div>
                <CardTitle>Provider Marketplace</CardTitle>
                <CardDescription>
                  Connect with multiple travel providers and expand your inventory seamlessly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• SOAP & REST APIs</li>
                  <li>• Real-time availability</li>
                  <li>• Competitive rates</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">Ready to transform your travel business?</h2>
          <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto px-4">
            Join leading travel agencies already using VIBOOK to streamline operations and increase bookings.
          </p>
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-gradient-hero hover:opacity-90 shadow-primary text-base md:text-lg px-6 md:px-8 w-full sm:w-auto max-w-xs sm:max-w-none"
          >
            Start Free Trial
            <ArrowRight className="ml-2 h-4 md:h-5 w-4 md:w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
