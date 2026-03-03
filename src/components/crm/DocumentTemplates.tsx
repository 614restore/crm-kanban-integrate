// Document Templates for Contractors
// Pre-built templates for estimates, invoices, contracts, work orders

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Edit,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  Eye,
  Star,
  StarOff,
  Calendar,
  DollarSign,
  Briefcase,
  FileSignature,
  ClipboardList,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'estimate' | 'invoice' | 'contract' | 'work-order' | 'proposal' | 'change-order' | 'safety' | 'other';
  content: string;
  variables: string[]; // e.g., ['CLIENT_NAME', 'PROJECT_ADDRESS', 'TOTAL_AMOUNT']
  favorite: boolean;
  isDefault: boolean;
  tags: string[];
  createdAt: string;
  lastModified: string;
  usageCount: number;
  fileType: 'pdf' | 'docx' | 'html';
}

interface TemplateFilters {
  category: string;
  tag: string;
  favorite: boolean;
}

const DocumentTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<DocumentTemplate[]>([]);
  const [filters, setFilters] = useState<TemplateFilters>({
    category: 'all',
    tag: 'all',
    favorite: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  // Template categories for contractors
  const templateCategories = [
    { id: 'estimate', label: 'Estimates', icon: <DollarSign className="w-4 h-4" />, color: 'bg-green-100 text-green-800' },
    { id: 'invoice', label: 'Invoices', icon: <FileText className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
    { id: 'contract', label: 'Contracts', icon: <FileSignature className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' },
    { id: 'work-order', label: 'Work Orders', icon: <ClipboardList className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800' },
    { id: 'proposal', label: 'Proposals', icon: <Briefcase className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-800' },
    { id: 'change-order', label: 'Change Orders', icon: <Edit className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-800' },
    { id: 'safety', label: 'Safety Forms', icon: <Wrench className="w-4 h-4" />, color: 'bg-red-100 text-red-800' },
    { id: 'other', label: 'Other', icon: <FileText className="w-4 h-4" />, color: 'bg-gray-100 text-gray-800' }
  ];

  // Load templates from storage/API
  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Mock data for demo
      const mockTemplates: DocumentTemplate[] = [
        {
          id: '1',
          name: 'Standard Storm Damage Estimate',
          description: 'Comprehensive estimate template for storm damage restoration projects',
          category: 'estimate',
          content: `# Storm Damage Estimate
          
**Project:** {{PROJECT_NAME}}
**Client:** {{CLIENT_NAME}}
**Address:** {{PROJECT_ADDRESS}}
**Date:** {{ESTIMATE_DATE}}

## Scope of Work
{{SCOPE_OF_WORK}}

## Materials
{{MATERIALS_LIST}}

## Labor
{{LABOR_BREAKDOWN}}

## Total: {{TOTAL_AMOUNT}}

*This estimate is valid for 30 days from the date above.*`,
          variables: ['PROJECT_NAME', 'CLIENT_NAME', 'PROJECT_ADDRESS', 'ESTIMATE_DATE', 'SCOPE_OF_WORK', 'MATERIALS_LIST', 'LABOR_BREAKDOWN', 'TOTAL_AMOUNT'],
          favorite: true,
          isDefault: true,
          tags: ['storm', 'restoration', 'roofing'],
          createdAt: '2026-01-15',
          lastModified: '2026-02-20',
          usageCount: 47,
          fileType: 'pdf'
        },
        {
          id: '2',
          name: 'Roofing Work Order',
          description: 'Standard work order template for roofing projects',
          category: 'work-order',
          content: `# Work Order - {{WORK_ORDER_NUMBER}}

**Client:** {{CLIENT_NAME}}
**Project Address:** {{PROJECT_ADDRESS}}
**Start Date:** {{START_DATE}}
**Estimated Completion:** {{COMPLETION_DATE}}

## Work Description
{{WORK_DESCRIPTION}}

## Materials Needed
{{MATERIALS_NEEDED}}

## Safety Requirements
- Hard hats required
- Safety harnesses for roof work
- Ladder safety protocols
{{ADDITIONAL_SAFETY}}

## Crew Assignment
{{CREW_ASSIGNMENT}}

**Supervisor:** {{SUPERVISOR_NAME}}
**Phone:** {{SUPERVISOR_PHONE}}`,
          variables: ['WORK_ORDER_NUMBER', 'CLIENT_NAME', 'PROJECT_ADDRESS', 'START_DATE', 'COMPLETION_DATE', 'WORK_DESCRIPTION', 'MATERIALS_NEEDED', 'ADDITIONAL_SAFETY', 'CREW_ASSIGNMENT', 'SUPERVISOR_NAME', 'SUPERVISOR_PHONE'],
          favorite: false,
          isDefault: false,
          tags: ['roofing', 'work-order', 'crew'],
          createdAt: '2026-02-01',
          lastModified: '2026-03-01',
          usageCount: 23,
          fileType: 'docx'
        },
        {
          id: '3',
          name: 'Change Order Authorization',
          description: 'Template for change order requests and approvals',
          category: 'change-order',
          content: `# CHANGE ORDER #{{CHANGE_ORDER_NUMBER}}

**Original Contract:** {{CONTRACT_NUMBER}}
**Project:** {{PROJECT_NAME}}
**Client:** {{CLIENT_NAME}}
**Date:** {{CHANGE_DATE}}

## Reason for Change
{{REASON_FOR_CHANGE}}

## Original Scope
{{ORIGINAL_SCOPE}}

## Additional Work Required
{{ADDITIONAL_WORK}}

## Cost Impact
- Additional Materials: {{ADDITIONAL_MATERIALS_COST}}
- Additional Labor: {{ADDITIONAL_LABOR_COST}}
- **Total Additional Cost:** {{TOTAL_ADDITIONAL_COST}}

## Schedule Impact
Original Completion Date: {{ORIGINAL_COMPLETION}}
New Completion Date: {{NEW_COMPLETION}}

**Client Approval Required**

Client Signature: _________________ Date: _______
Contractor Signature: _____________ Date: _______`,
          variables: ['CHANGE_ORDER_NUMBER', 'CONTRACT_NUMBER', 'PROJECT_NAME', 'CLIENT_NAME', 'CHANGE_DATE', 'REASON_FOR_CHANGE', 'ORIGINAL_SCOPE', 'ADDITIONAL_WORK', 'ADDITIONAL_MATERIALS_COST', 'ADDITIONAL_LABOR_COST', 'TOTAL_ADDITIONAL_COST', 'ORIGINAL_COMPLETION', 'NEW_COMPLETION'],
          favorite: false,
          isDefault: false,
          tags: ['change-order', 'approval', 'contract'],
          createdAt: '2026-02-10',
          lastModified: '2026-02-25',
          usageCount: 8,
          fileType: 'pdf'
        },
        {
          id: '4',
          name: 'Daily Safety Checklist',
          description: 'Daily safety inspection form for job sites',
          category: 'safety',
          content: `# Daily Safety Checklist
          
**Date:** {{INSPECTION_DATE}}
**Job Site:** {{JOB_SITE}}
**Inspector:** {{INSPECTOR_NAME}}

## Personal Protective Equipment
- [ ] Hard hats available and worn
- [ ] Safety glasses available and worn  
- [ ] Steel-toed boots worn
- [ ] High-visibility vests worn
- [ ] Fall protection equipment inspected

## Equipment Safety
- [ ] Power tools inspected
- [ ] Ladders inspected and properly positioned
- [ ] Scaffolding secure and inspected
- [ ] Electrical cords and connections safe

## Site Conditions
- [ ] Work area clean and organized
- [ ] Emergency exits clear
- [ ] First aid kit accessible
- [ ] Fire extinguisher accessible

## Weather Conditions
Current Weather: {{WEATHER_CONDITIONS}}
Wind Speed: {{WIND_SPEED}}
Temperature: {{TEMPERATURE}}

**Inspector Signature:** _________________ 
**Date:** {{SIGNATURE_DATE}}`,
          variables: ['INSPECTION_DATE', 'JOB_SITE', 'INSPECTOR_NAME', 'WEATHER_CONDITIONS', 'WIND_SPEED', 'TEMPERATURE', 'SIGNATURE_DATE'],
          favorite: true,
          isDefault: false,
          tags: ['safety', 'inspection', 'daily'],
          createdAt: '2026-01-20',
          lastModified: '2026-02-15',
          usageCount: 156,
          fileType: 'html'
        }
      ];
      
      setTemplates(mockTemplates);
      setFilteredTemplates(mockTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error",
        description: "Could not load document templates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...templates];

    // Apply filters
    if (filters.category !== 'all') {
      filtered = filtered.filter(template => template.category === filters.category);
    }
    if (filters.favorite) {
      filtered = filtered.filter(template => template.favorite);
    }
    if (filters.tag !== 'all') {
      filtered = filtered.filter(template => template.tags.includes(filters.tag));
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredTemplates(filtered);
  }, [templates, filters, searchQuery]);

  // Toggle favorite
  const toggleFavorite = (templateId: string) => {
    setTemplates(prev => prev.map(template => 
      template.id === templateId 
        ? { ...template, favorite: !template.favorite }
        : template
    ));
    
    toast({
      title: "Updated",
      description: "Template favorite status updated",
      variant: "default"
    });
  };

  // Duplicate template
  const duplicateTemplate = (template: DocumentTemplate) => {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      usageCount: 0
    };
    
    setTemplates(prev => [newTemplate, ...prev]);
    
    toast({
      title: "Template Duplicated",
      description: `Created copy of "${template.name}"`,
      variant: "default"
    });
  };

  // Preview template with sample data
  const getPreviewContent = (template: DocumentTemplate) => {
    let content = template.content;
    
    // Replace variables with sample data
    const sampleData: Record<string, string> = {
      'PROJECT_NAME': 'Johnson Residence Roof Repair',
      'CLIENT_NAME': 'John & Mary Johnson',
      'PROJECT_ADDRESS': '123 Oak Street, Springfield, IL',
      'ESTIMATE_DATE': new Date().toLocaleDateString(),
      'TOTAL_AMOUNT': '$12,500.00',
      'WORK_ORDER_NUMBER': 'WO-2026-001',
      'START_DATE': new Date().toLocaleDateString(),
      'COMPLETION_DATE': new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString(),
      'INSPECTOR_NAME': 'Mike Wilson',
      'JOB_SITE': '123 Oak Street',
      'WEATHER_CONDITIONS': 'Clear, Sunny'
    };
    
    template.variables.forEach(variable => {
      const replacement = sampleData[variable] || `[${variable}]`;
      content = content.replace(new RegExp(`{{${variable}}}`, 'g'), replacement);
    });
    
    return content;
  };

  // Get all unique tags
  const allTags = Array.from(new Set(templates.flatMap(t => t.tags))).sort();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Document Templates</h1>
        </div>
        <Button onClick={() => setShowCreateTemplate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Category Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {templateCategories.map(category => {
          const count = templates.filter(t => t.category === category.id).length;
          return (
            <Card 
              key={category.id} 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                filters.category === category.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setFilters({
                ...filters,
                category: filters.category === category.id ? 'all' : category.id
              })}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {category.icon}
                    <div>
                      <p className="font-medium">{category.label}</p>
                      <p className="text-sm text-gray-600">{count} templates</p>
                    </div>
                  </div>
                  <Badge className={category.color}>
                    {count}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {templateCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.tag} onValueChange={(value) => setFilters({...filters, tag: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch 
                checked={filters.favorite}
                onCheckedChange={(checked) => setFilters({...filters, favorite: checked})}
              />
              <Label>Favorites only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({length: 6}).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))
        ) : filteredTemplates.length === 0 ? (
          <div className="md:col-span-3 text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No templates found</p>
            <Button 
              onClick={() => setShowCreateTemplate(true)} 
              className="mt-4"
            >
              Create Your First Template
            </Button>
          </div>
        ) : (
          filteredTemplates.map(template => {
            const category = templateCategories.find(c => c.id === template.category);
            return (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          {template.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(template.id)}
                      >
                        {template.favorite ? (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge className={category?.color}>
                        <div className="flex items-center gap-1">
                          {category?.icon}
                          {category?.label}
                        </div>
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Used {template.usageCount} times
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Modified {new Date(template.lastModified).toLocaleDateString()}</span>
                      <span className="capitalize">{template.fileType}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setPreviewMode(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => duplicateTemplate(template)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && previewMode && (
        <Dialog open={previewMode} onOpenChange={() => {
          setPreviewMode(false);
          setSelectedTemplate(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.name} - Preview</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <Label>Variables in this template:</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedTemplate.variables.map(variable => (
                    <Badge key={variable} variant="secondary" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="border rounded p-4 bg-white">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {getPreviewContent(selectedTemplate)}
                </pre>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => duplicateTemplate(selectedTemplate)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </Button>
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Generate Document
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DocumentTemplates;