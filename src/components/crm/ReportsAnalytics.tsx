// Reports & Analytics Dashboard for Contractors
// Comprehensive business intelligence and performance metrics

import React, { useState, useEffect, useMemo } from 'react';
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

  // Mock data - in real app would come from API
  // Memoized to prevent unnecessary re-renders
  const revenueData: RevenueData[] = useMemo(() => [
    { month: 'Jan', revenue: 45000, expenses: 32000, profit: 13000, projects: 8 },
    { month: 'Feb', revenue: 52000, expenses: 35000, profit: 17000, projects: 10 },
    { month: 'Mar', revenue: 48000, expenses: 33000, profit: 15000, projects: 9 },
    { month: 'Apr', revenue: 61000, expenses: 39000, profit: 22000, projects: 12 },
    { month: 'May', revenue: 58000, expenses: 37000, profit: 21000, projects: 11 },
    { month: 'Jun', revenue: 67000, expenses: 41000, profit: 26000, projects: 13 },
    { month: 'Jul', revenue: 72000, expenses: 43000, profit: 29000, projects: 14 },
    { month: 'Aug', revenue: 69000, expenses: 42000, profit: 27000, projects: 13 },
    { month: 'Sep', revenue: 74000, expenses: 44000, profit: 30000, projects: 15 },
    { month: 'Oct', revenue: 78000, expenses: 46000, profit: 32000, projects: 16 },
    { month: 'Nov', revenue: 71000, expenses: 43000, profit: 28000, projects: 14 },
    { month: 'Dec', revenue: 83000, expenses: 48000, profit: 35000, projects: 17 }
  ], []);

  const projectData: ProjectData[] = useMemo(() => [
    {
      id: '1',
      name: 'Johnson Roof Replacement',
      client: 'John Johnson',
      value: 15000,
      profit: 4500,
      profitMargin: 30,
      status: 'completed',
      startDate: '2026-01-15',
      completionDate: '2026-02-10',
      category: 'Roofing'
    },
    {
      id: '2',
      name: 'Smith Storm Damage',
      client: 'Mary Smith',
      value: 22000,
      profit: 7700,
      profitMargin: 35,
      status: 'active',
      startDate: '2026-02-01',
      category: 'Storm Restoration'
    },
    {
      id: '3',
      name: 'Wilson Siding Repair',
      client: 'Bob Wilson',
      value: 8500,
      profit: 2550,
      profitMargin: 30,
      status: 'completed',
      startDate: '2026-02-15',
      completionDate: '2026-03-01',
      category: 'Siding'
    },
    {
      id: '4',
      name: 'Downtown Office Complex',
      client: 'ABC Corp',
      value: 45000,
      profit: 13500,
      profitMargin: 30,
      status: 'planning',
      startDate: '2026-03-15',
      category: 'Commercial'
    }
  ], []);

  const leadSources: LeadData[] = useMemo(() => [
    { source: 'Google Ads', leads: 45, conversions: 12, conversionRate: 26.7, revenue: 125000 },
    { source: 'Referrals', leads: 32, conversions: 18, conversionRate: 56.3, revenue: 180000 },
    { source: 'Facebook', leads: 28, conversions: 6, conversionRate: 21.4, revenue: 65000 },
    { source: 'Direct', leads: 15, conversions: 8, conversionRate: 53.3, revenue: 95000 },
    { source: 'Yellow Pages', leads: 12, conversions: 3, conversionRate: 25.0, revenue: 35000 }
  ], []);

  const teamPerformance: TeamPerformance[] = [
    { member: 'Mike Johnson', projectsCompleted: 12, revenue: 145000, customerRating: 4.8, efficiency: 95 },
    { member: 'Sarah Wilson', projectsCompleted: 10, revenue: 125000, customerRating: 4.9, efficiency: 92 },
    { member: 'Tom Brown', projectsCompleted: 8, revenue: 98000, customerRating: 4.6, efficiency: 88 },
    { member: 'Lisa Davis', projectsCompleted: 15, revenue: 180000, customerRating: 4.7, efficiency: 90 }
  ];

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
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
    
    toast({
      title: "Data Refreshed",
      description: "Analytics data has been updated with latest information",
      variant: "default"
    });
  };

  // Export report
  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your analytics report is being generated",
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
                  <span>+12.5% from last period</span>
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
                <p className="text-2xl font-bold text-green-600">+84%</p>
                <p className="text-sm text-gray-600">Year over year</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold">Efficiency Improvement</h3>
                <p className="text-2xl font-bold text-blue-600">+23%</p>
                <p className="text-sm text-gray-600">Project completion time</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-semibold">Customer Satisfaction</h3>
                <p className="text-2xl font-bold text-yellow-600">4.8/5</p>
                <p className="text-sm text-gray-600">Average rating</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsAnalytics;