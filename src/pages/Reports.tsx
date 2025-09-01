import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { 
  Download, 
  TrendingUp, 
  TrendingDown,
  MessageSquare,
  FileText,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

const Reports = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ 
    from: new Date(), 
    to: new Date() 
  });
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  const kpiData = {
    totalConversations: 156,
    quotesGenerated: 89,
    pdfsCreated: 67,
    conversionRate: 42.3,
    averageResponseTime: 1.8,
    leadsWon: 28,
    revenue: 156420
  };

  const providerMetrics = [
    { name: 'Eurovips', requests: 45, success: 42, avgLatency: 850, errors: 3 },
    { name: 'Lozada', requests: 32, success: 30, avgLatency: 1200, errors: 2 },
    { name: 'Ícaro', requests: 28, success: 25, avgLatency: 950, errors: 3 },
    { name: 'Delfos', requests: 15, success: 12, avgLatency: 1500, errors: 3 },
  ];

  const channelData = [
    { channel: 'WhatsApp', conversations: 98, quotes: 58, conversion: 45.2 },
    { channel: 'Web', conversations: 58, quotes: 31, conversion: 38.7 },
  ];

  const handleExport = () => {
    // TODO: Generate and download report
    console.log('Exporting report...');
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-1">Analytics and performance insights</p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <DatePickerWithRange 
                  date={dateRange}
                  onDateChange={setDateRange}
                />
              </div>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="eurovips">Eurovips</SelectItem>
                  <SelectItem value="lozada">Lozada</SelectItem>
                  <SelectItem value="icaro">Ícaro</SelectItem>
                  <SelectItem value="delfos">Delfos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="wa">WhatsApp</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.totalConversations}</div>
              <p className="text-xs text-success">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +18% from last period
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes Generated</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.quotesGenerated}</div>
              <p className="text-xs text-muted-foreground">
                {kpiData.pdfsCreated} PDFs created
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.conversionRate}%</div>
              <Progress value={kpiData.conversionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${kpiData.revenue.toLocaleString()}</div>
              <p className="text-xs text-success">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +24% from last period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Channel Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
              <CardDescription>Comparison across communication channels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {channelData.map((channel) => (
                <div key={channel.channel} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{channel.channel}</span>
                    <Badge variant="outline">{channel.conversion}% conversion</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <MessageSquare className="inline h-3 w-3 mr-1" />
                      {channel.conversations} conversations
                    </div>
                    <div>
                      <FileText className="inline h-3 w-3 mr-1" />
                      {channel.quotes} quotes
                    </div>
                  </div>
                  <Progress value={channel.conversion} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Response Time Metrics</CardTitle>
              <CardDescription>Average response times by hour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-card rounded-lg">
                <div>
                  <p className="font-medium">Average Response Time</p>
                  <p className="text-2xl font-bold">{kpiData.averageResponseTime}s</p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Peak Hours (9-17)</span>
                  <span>1.2s</span>
                </div>
                <Progress value={70} className="h-2" />
                <div className="flex justify-between text-sm">
                  <span>Off Hours (18-8)</span>
                  <span>2.8s</span>
                </div>
                <Progress value={40} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider Performance */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Provider Performance</CardTitle>
            <CardDescription>Integration metrics and reliability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {providerMetrics.map((provider) => (
                <div key={provider.name} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{provider.name}</h4>
                    <div className="flex items-center space-x-2">
                      <Badge variant={provider.errors < 3 ? 'default' : 'destructive'}>
                        {provider.errors < 3 ? 'Healthy' : 'Issues'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Requests</p>
                      <p className="font-bold">{provider.requests}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Success Rate</p>
                      <p className="font-bold text-success">
                        {((provider.success / provider.requests) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Latency</p>
                      <p className="font-bold">{provider.avgLatency}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Errors</p>
                      <p className={`font-bold ${provider.errors > 2 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {provider.errors}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-success text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {provider.success} successful
                    </div>
                    {provider.errors > 0 && (
                      <div className="flex items-center text-destructive text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        {provider.errors} errors
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Reports;