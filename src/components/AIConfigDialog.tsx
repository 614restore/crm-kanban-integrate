import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { AIProviderConfig, AIAssistantSettings } from '@/lib/integrations/aiAssistant';
import AIAssistantIntegrationClass from '@/lib/integrations/aiAssistantIntegration';
import { aiConfigurationManager } from '@/lib/aiConfigurationManager';
import { useAuth } from '@/lib/authContext';
import { useCRM } from '@/lib/crmStore';

interface AIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (config: any) => void;
}

export default function AIConfigDialog({ open, onOpenChange, onSave }: AIConfigDialogProps) {
  const { profile } = useAuth();
  const { state } = useCRM();
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [region, setRegion] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [maxTokens, setMaxTokens] = useState(1000);
  const [temperature, setTemperature] = useState(0.3);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a professional contractor assistant. Help with customer communications, lead analysis, and business automation.'
  );
  const [features, setFeatures] = useState({
    customerSupport: true,
    emailDrafting: true,
    contractAnalysis: false,
    estimateReview: true,
    leadScoring: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const providerModels: Record<string, string[]> = {
    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    google: ['gemini-pro', 'gemini-1.5-pro'],
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider as any);
    setModel(providerModels[newProvider]?.[0] || 'gpt-4');
    setOrganizationId('');
    setRegion('');
  };

  const handleFeatureToggle = (feature: keyof typeof features) => {
    setFeatures((prev) => ({
      ...prev,
      [feature]: !prev[feature],
    }));
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestMessage('Please enter an API key');
      setTestStatus('error');
      return;
    }

    setIsTesting(true);
    setTestStatus('idle');

    try {
      const integration = new AIAssistantIntegrationClass(
        provider,
        apiKey,
        {
          model,
          maxTokens,
          temperature,
          systemPrompt,
          features,
        },
        organizationId || undefined,
        region || undefined
      );

      const result = await integration.testConnection();

      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message);
        toast.success('AI connection test successful!');
      } else {
        setTestStatus('error');
        setTestMessage(result.message);
        toast.error(result.message);
      }
    } catch (error) {
      setTestStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setTestMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    if (testStatus !== 'success') {
      toast.error('Please test the connection first');
      return;
    }

    setIsLoading(true);

    try {
      if (!profile?.id || !state.companyId) {
        throw new Error('User or company not found');
      }

      const config = await aiConfigurationManager.saveConfiguration(
        state.companyId,
        profile.id,
        {
          provider,
          apiKey,
          organizationId: organizationId || undefined,
          region: region || undefined,
          model,
          maxTokens,
          temperature,
          systemPrompt,
          features,
        }
      );

      if (config) {
        toast.success('AI Assistant configuration saved! Awaiting admin approval.');
        onSave?.(config);
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProvider('openai');
    setApiKey('');
    setShowApiKey(false);
    setOrganizationId('');
    setRegion('');
    setModel('gpt-4');
    setMaxTokens(1000);
    setTemperature(0.3);
    setSystemPrompt(
      'You are a professional contractor assistant. Help with customer communications, lead analysis, and business automation.'
    );
    setFeatures({
      customerSupport: true,
      emailDrafting: true,
      contractAnalysis: false,
      estimateReview: true,
      leadScoring: true,
    });
    setTestStatus('idle');
    setTestMessage('');
  };

  const providerDocs: Record<string, string> = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/account/keys',
    google: 'https://makersuite.google.com/app/apikey',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure AI Assistant</DialogTitle>
          <DialogDescription>
            Add your AI provider API key to enable smart business automation features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Provider</CardTitle>
              <CardDescription>Choose your preferred AI provider</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="google">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-gray-600">
                Don't have an API key?{' '}
                <a
                  href={providerDocs[provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Get one here
                </a>
              </p>
            </CardContent>
          </Card>

          {/* API Key Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Credentials</CardTitle>
              <CardDescription>Enter your API key and optional settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API Key */}
              <div>
                <Label htmlFor="api-key">API Key *</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Enter your ${provider} API key`}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-2.5 text-gray-400"
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Organization ID (OpenAI only) */}
              {provider === 'openai' && (
                <div>
                  <Label htmlFor="org-id">Organization ID (Optional)</Label>
                  <Input
                    id="org-id"
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    placeholder="org-xxxxx"
                  />
                </div>
              )}

              {/* Region (Google only) */}
              {provider === 'google' && (
                <div>
                  <Label htmlFor="region">Region (Optional)</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Default (us-central1)</SelectItem>
                      <SelectItem value="us-west1">us-west1</SelectItem>
                      <SelectItem value="us-east1">us-east1</SelectItem>
                      <SelectItem value="europe-west1">europe-west1</SelectItem>
                      <SelectItem value="asia-southeast1">asia-southeast1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model Configuration</CardTitle>
              <CardDescription>Fine-tune the AI behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Model Selection */}
              <div>
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerModels[provider]?.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Max Tokens */}
              <div>
                <Label htmlFor="max-tokens">
                  Max Tokens: <span className="font-semibold">{maxTokens}</span>
                </Label>
                <input
                  id="max-tokens"
                  type="range"
                  min={256}
                  max={4096}
                  step={256}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Higher = longer responses, more cost</p>
              </div>

              {/* Temperature */}
              <div>
                <Label htmlFor="temperature">
                  Temperature: <span className="font-semibold">{temperature.toFixed(2)}</span>
                </Label>
                <input
                  id="temperature"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0 = Consistent, 1 = Balanced, 2 = Creative
                </p>
              </div>

              {/* System Prompt */}
              <div>
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  placeholder="Define the AI's behavior and role"
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enable Features</CardTitle>
              <CardDescription>Choose which AI features to enable for your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customerSupport"
                  checked={features.customerSupport}
                  onCheckedChange={() => handleFeatureToggle('customerSupport')}
                />
                <label htmlFor="customerSupport" className="text-sm cursor-pointer">
                  <span className="font-medium">Customer Support Chat</span>
                  <span className="text-gray-600"> - AI-powered customer query responses</span>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emailDrafting"
                  checked={features.emailDrafting}
                  onCheckedChange={() => handleFeatureToggle('emailDrafting')}
                />
                <label htmlFor="emailDrafting" className="text-sm cursor-pointer">
                  <span className="font-medium">Email Drafting</span>
                  <span className="text-gray-600"> - Generate professional email responses</span>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="leadScoring"
                  checked={features.leadScoring}
                  onCheckedChange={() => handleFeatureToggle('leadScoring')}
                />
                <label htmlFor="leadScoring" className="text-sm cursor-pointer">
                  <span className="font-medium">Lead Scoring</span>
                  <span className="text-gray-600"> - Analyze and score potential leads</span>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="estimateReview"
                  checked={features.estimateReview}
                  onCheckedChange={() => handleFeatureToggle('estimateReview')}
                />
                <label htmlFor="estimateReview" className="text-sm cursor-pointer">
                  <span className="font-medium">Estimate Review</span>
                  <span className="text-gray-600"> - AI-powered estimate optimization</span>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="contractAnalysis"
                  checked={features.contractAnalysis}
                  onCheckedChange={() => handleFeatureToggle('contractAnalysis')}
                />
                <label htmlFor="contractAnalysis" className="text-sm cursor-pointer">
                  <span className="font-medium">Contract Analysis</span>
                  <span className="text-gray-600"> - Review and analyze contracts</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Test Status */}
          {testStatus !== 'idle' && (
            <div
              className={`flex items-start gap-3 p-4 rounded-lg ${
                testStatus === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              {testStatus === 'success' ? (
                <CheckCircle className="text-green-600 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-red-600 mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${testStatus === 'success' ? 'text-green-900' : 'text-red-900'}`}
                >
                  {testMessage}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleTestConnection()}
              disabled={!apiKey.trim() || isTesting}
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={isLoading || testStatus !== 'success'}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Saving...
                </>
              ) : (
                'Save & Request Approval'
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-medium mb-1">⚠️ Security Notice</p>
            <p>Your API key is encrypted and stored securely. Team admins must approve access before other team members can use it.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
