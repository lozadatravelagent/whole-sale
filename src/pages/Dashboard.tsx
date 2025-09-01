import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Activity
} from 'lucide-react';

const Dashboard = () => {
  const metrics = {
    conversations_today: 23,
    quotes_generated: 12,
    pdfs_created: 8,
    leads_won: 3,
    leads_lost: 2,
    conversion_rate: 60
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your travel agency performance
            </p>
          </div>
          <Badge variant="outline" className="h-6">
            Today, {new Date().toLocaleDateString()}
          </Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversations Today</CardTitle>
              <MessageSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversations_today}</div>
              <p className="text-xs text-success">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +12% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes Generated</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.quotes_generated}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.pdfs_created} PDFs created
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Won</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{metrics.leads_won}</div>
              <p className="text-xs text-destructive">
                <TrendingDown className="inline h-3 w-3 mr-1" />
                {metrics.leads_lost} lost
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Activity className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversion_rate}%</div>
              <Progress value={metrics.conversion_rate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
              <CardDescription>Latest customer interactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 1, customer: 'María González', channel: 'WhatsApp', time: '2 min ago', status: 'active' },
                { id: 2, customer: 'Carlos Ruiz', channel: 'Web', time: '15 min ago', status: 'quoted' },
                { id: 3, customer: 'Ana López', channel: 'WhatsApp', time: '1 hour ago', status: 'closed' },
              ].map((conversation) => (
                <div key={conversation.id} className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{conversation.customer}</p>
                      <p className="text-xs text-muted-foreground">{conversation.channel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                      {conversation.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{conversation.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Top Destinations</CardTitle>
              <CardDescription>Most requested this week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { destination: 'Buenos Aires', requests: 15, revenue: '$12,400' },
                { destination: 'Madrid', requests: 12, revenue: '$18,600' },
                { destination: 'Miami', requests: 8, revenue: '$24,800' },
                { destination: 'Cancún', requests: 6, revenue: '$9,200' },
              ].map((dest, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">{dest.destination}</p>
                      <p className="text-xs text-muted-foreground">{dest.requests} requests</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">{dest.revenue}</p>
                    <DollarSign className="h-3 w-3 text-success inline" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;