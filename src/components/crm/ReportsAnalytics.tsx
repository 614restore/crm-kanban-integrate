// Reports & Analytics Dashboard for Contractors
// Comprehensive business intelligence and performance metrics

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Target,
  Star,
  FileText,
  Clock,
  Award,
  Briefcase,
  Receipt,
  Filter,
  Download,
  RefreshCw,
  Eye,
  PieChart as PieChartIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useCRM, useFinancialStats } from '@/lib/crmStore';
import { formatCurrency, getContactFullName } from '@/lib/crmData';

interface RevenueData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  projects: number;
}

interface ProjectData {
  id: string;
  name: string;
  client: string;
  value: number;
  profit: number;
  profitMargin: number;
  status: 'planning' | 'active' | 'completed' | 'on-hold';
  startDate: string;
  completionDate?: string;
  category: string;
}

interface LeadData {
  source: string;
  leads: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
}

interface TeamPerformance {
  member: string;
  projectsCompleted: number;
  revenue: number;
  customerRating: number;
  efficiency: number;
}

const ReportsAnalytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('12months');
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const { toast } = useToast();
  const { state } = useCRM();
  const financialStats = useFinancialStats();

  // Build revenue data from real invoices grouped by month
  const revenueData: RevenueData[] = useMemo(() => {
    const months: Record<string, { revenue: number; expenses: number; projects: Set<string> }> = {};
    const now = new Date();
    // Seed last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short' });
      months[key] = { revenue: 0, expenses: 0, projects: new Set() };
    }
    // Sum invoices by month
    state.invoices.forEach((inv) => {
      const d = new Date(inv.createdAt || inv.dueDate || '');
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleString('default', { month: 'short' });
      if (months[key]) {
        if (inv.status === 'paid') months[key].revenue += inv.amount;
        if (inv.contactId) months[key].projects.add(inv.contactId);
      }
    });
    // Sum deposits & final payments from contacts by completed month
    state.contacts.forEach((c) => {
      if (c.status === 'completed' && c.finalPaymentPaid && c.finalPaymentAmount) {
        const d = new Date(c.updatedAt);
        const key = d.toLocaleString('default', { month: 'short' });
        if (months[key]) months[key].revenue += c.finalPaymentAmount;
      }
    });
    // Estimate expenses as 65% of revenue (industry avg) when we don't have real expense data
    return Object.entries(months).map(([month, data]) => {
      const estimatedExpenses = Math.round(data.revenue * 0.65);
      return {
        month,
        revenue: data.revenue,
        expenses: estimatedExpenses,
        profit: data.revenue - estimatedExpenses,
        projects: data.projects.size,
      };
    });
  }, [state.invoices, state.contacts]);

  // Build project data from real projects or contacts in project stages
  const projectData: ProjectData[] = useMemo(() => {
    if (state.projects.length > 0) {
      return state.projects.map((p) => ({
        id: p.id,
        name: p.name || 'Unnamed Project',
        client: p.contactName || '',
        value: p.estimatedBudget || 0,
        profit: Math.round((p.estimatedBudget || 0) - (p.actualCost || 0)) || Math.round((p.estimatedBudget || 0) * 0.30),
        profitMargin: p.estimatedBudget ? Math.round(((p.estimatedBudget - (p.actualCost || 0)) / p.estimatedBudget) * 100) : 30,
        status: (p.status === 'in_progress' ? 'active' : p.status === 'scheduled' ? 'planning' : p.status) as ProjectData['status'],
        startDate: p.startDate || p.createdAt,
        completionDate: p.completedDate || p.endDate,
        category: p.tags?.[0] || 'General',
      }));
    }
    // Fallback: derive from contacts
    return state.contacts
      .filter((c) => ['in_progress', 'build_phase', 'completed', 'contingency'].includes(c.status))
      .map((c) => ({
        id: c.id,
        name: `${getContactFullName(c)} Project`,
        client: getContactFullName(c),
        value: c.projectValue || 0,
        profit: Math.round((c.projectValue || 0) * 0.30),
        profitMargin: 30,
        status: (c.status === 'completed' ? 'completed' : 'active') as ProjectData['status'],
        startDate: c.createdAt,
        completionDate: c.status === 'completed' ? c.updatedAt : undefined,
        category: c.insuranceCompany ? 'Insurance' : 'Retail',
      }));
  }, [state.projects, state.contacts]);

  // Build lead source data from contacts
  const leadSources: LeadData[] = useMemo(() => {
    const sources: Record<string, { leads: number; conversions: number; revenue: number }> = {};
    state.contacts.forEach((c) => {
      const src = c.leadSource || 'Direct';
      if (!sources[src]) sources[src] = { leads: 0, conversions: 0, revenue: 0 };
      sources[src].leads += 1;
      if (c.status === 'completed' || c.status === 'in_progress' || c.status === 'build_phase') {
        sources[src].conversions += 1;
        sources[src].revenue += c.projectValue || 0;
      }
    });
    return Object.entries(sources)
      .map(([source, data]) => ({
        source,
        leads: data.leads,
        conversions: data.conversions,
        conversionRate: data.leads > 0 ? (data.conversions / data.leads) * 100 : 0,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [state.contacts]);

  // Build team performance from real team members
  const teamPerformance: TeamPerformance[] = useMemo(() => {
    return state.teamMembers
      .filter((tm) => tm.isActive)
      .map((tm) => ({
        member: tm.name || tm.email,
        projectsCompleted: tm.performance?.dealsClosed || 0,
        revenue: tm.performance?.revenue || 0,
        customerRating: 0,
        efficiency: tm.performance?.leadsGenerated ? Math.round((tm.performance.dealsClosed / tm.performance.leadsGenerated) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [state.teamMembers]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
    const totalExpenses = revenueData.reduce((sum, item) => sum + item.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const avgProfitMargin = (totalProfit / totalRevenue) * 100;
    
    const totalProjects = projectData.length;
    const completedProjects = projectData.filter(p => p.status === 'completed').length;
    const activeProjects = projectData.filter(p => p.status === 'active').length;
    
    const completionRate = (completedProjects / totalProjects) * 100;
    
    const totalLeads = leadSources.reduce((sum, source) => sum + source.leads, 0);
    const totalConversions = leadSources.reduce((sum, source) => sum + source.conversions, 0);
    const overallConversionRate = (totalConversions / totalLeads) * 100;

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      avgProfitMargin,
      totalProjects,
      completedProjects,
      activeProjects,
      completionRate,
      totalLeads,
      totalConversions,
      overallConversionRate
    };
  }, [revenueData, projectData, leadSources]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    // Data is live from CRM state; brief delay for UX feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
    
    toast({
      title: "Data Refreshed",
      description: "Analytics data reflects the latest CRM information",
      variant: "default"
    });
  };

  // Export report as CSV
  const handleExport = () => {
    const headers = ['Month', 'Revenue', 'Expenses', 'Profit', 'Projects'];
    const rows = revenueData.map(r => [r.month, r.revenue, r.expenses, r.profit, r.projects].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: "Analytics report has been downloaded as CSV",
      variant: "default"
    });
  };

  // Chart colors
  const colors = {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    cyan: '#06b6d4'
  };

  const CHART_COLORS = [colors.primary, colors.secondary, colors.accent, colors.purple, colors.cyan];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="12months">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="w-3 h-3" />
                  <span>{revenueData.length} months tracked</span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Profit</p>
                <p className="text-2xl font-bold">${metrics.totalProfit.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="w-3 h-3" />
                  <span>{metrics.avgProfitMargin.toFixed(1)}% margin</span>
                </div>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold">{metrics.activeProjects}</p>
                <div className="flex items-center gap-1 text-blue-600 text-sm">
                  <Eye className="w-3 h-3" />
                  <span>{metrics.completionRate.toFixed(1)}% completion rate</span>
                </div>
              </div>
              <Briefcase className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lead Conversion</p>
                <p className="text-2xl font-bold">{metrics.overallConversionRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 text-orange-600 text-sm">
                  <Users className="w-3 h-3" />
                  <span>{metrics.totalConversions} of {metrics.totalLeads} leads</span>
                </div>
              </div>
              <Target className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Lead Sources
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Award className="w-4 h-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Revenue Analytics */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stackId="1" 
                      stroke={colors.primary} 
                      fill={colors.primary} 
                      fillOpacity={0.8} 
                      name="Revenue"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expenses" 
                      stackId="2" 
                      stroke={colors.danger} 
                      fill={colors.danger} 
                      fillOpacity={0.8} 
                      name="Expenses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Profit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Profit']} />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke={colors.secondary} 
                      strokeWidth={3}
                      dot={{ fill: colors.secondary, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {revenueData.slice(-3).map((item, index) => (
                  <div key={item.month} className="text-center p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">{item.month}</h3>
                    <p className="text-2xl font-bold text-green-600">${item.revenue.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">{item.projects} projects</p>
                    <p className="text-sm text-gray-600">
                      {Math.round((item.profit / item.revenue) * 100)}% margin
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Analytics */}
        <TabsContent value="projects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: projectData.filter(p => p.status === 'completed').length },
                        { name: 'Active', value: projectData.filter(p => p.status === 'active').length },
                        { name: 'Planning', value: projectData.filter(p => p.status === 'planning').length },
                        { name: 'On Hold', value: projectData.filter(p => p.status === 'on-hold').length }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1, 2, 3].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Profitability</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={projectData.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Bar dataKey="value" fill={colors.primary} name="Total Value" />
                    <Bar dataKey="profit" fill={colors.secondary} name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Profitable Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {projectData
                  .sort((a, b) => b.profit - a.profit)
                  .slice(0, 5)
                  .map((project, index) => (
                    <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">{project.name}</h4>
                          <p className="text-sm text-gray-600">{project.client}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${project.profit.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{project.profitMargin}% margin</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Sources Analytics */}
        <TabsContent value="leads" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Conversion Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadSources}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [
                      name === 'conversionRate' ? `${Number(value).toFixed(1)}%` : value,
                      name === 'conversionRate' ? 'Conversion Rate' : name
                    ]} />
                    <Legend />
                    <Bar dataKey="leads" fill={colors.primary} name="Total Leads" />
                    <Bar dataKey="conversions" fill={colors.secondary} name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Lead Source</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadSources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({source, percent}) => `${source} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {leadSources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lead Source Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Source</th>
                      <th className="text-right p-2">Leads</th>
                      <th className="text-right p-2">Conversions</th>
                      <th className="text-right p-2">Rate</th>
                      <th className="text-right p-2">Revenue</th>
                      <th className="text-right p-2">Cost per Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadSources.map((source, index) => (
                      <tr key={source.source} className="border-b">
                        <td className="p-2 font-medium">{source.source}</td>
                        <td className="p-2 text-right">{source.leads}</td>
                        <td className="p-2 text-right">{source.conversions}</td>
                        <td className="p-2 text-right">
                          <Badge className={source.conversionRate > 40 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {source.conversionRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-bold">${source.revenue.toLocaleString()}</td>
                        <td className="p-2 text-right">${Math.round(source.revenue / source.leads).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Performance */}
        <TabsContent value="team" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Revenue Contribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="member" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill={colors.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Efficiency vs Customer Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={teamPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="member" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke={colors.secondary} 
                      fill={colors.secondary} 
                      fillOpacity={0.6}
                      name="Efficiency %"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="customerRating" 
                      stroke={colors.accent} 
                      fill={colors.accent} 
                      fillOpacity={0.6}
                      name="Customer Rating"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {teamPerformance.map((member, index) => (
                  <div key={member.member} className="p-4 border rounded-lg text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-600 font-bold">{member.member.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <h3 className="font-semibold">{member.member}</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-green-600 font-bold">${member.revenue.toLocaleString()}</p>
                      <p className="text-gray-600">{member.projectsCompleted} projects</p>
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span>{member.customerRating}</span>
                      </div>
                      <Badge className="text-xs">
                        {member.efficiency}% efficient
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Growth Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke={colors.primary} 
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="profit" 
                    stroke={colors.secondary} 
                    strokeWidth={2}
                    name="Profit"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="projects" 
                    stroke={colors.accent} 
                    strokeWidth={2}
                    name="Projects"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold">Revenue Growth</h3>
                <p className="text-2xl font-bold text-green-600">
                  {revenueData.length >= 2
                    ? (() => {
                        const last = revenueData[revenueData.length - 1]?.revenue || 0;
                        const first = revenueData[0]?.revenue || 1;
                        const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
                        return `${pct >= 0 ? '+' : ''}${pct}%`;
                      })()
                    : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">First to last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold">Total Projects</h3>
                <p className="text-2xl font-bold text-blue-600">{projectData.length}</p>
                <p className="text-sm text-gray-600">{projectData.filter(p => p.status === 'completed').length} completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-semibold">Lead Conversion</h3>
                <p className="text-2xl font-bold text-yellow-600">{metrics.overallConversionRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">{metrics.totalConversions} of {metrics.totalLeads} leads</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsAnalytics;