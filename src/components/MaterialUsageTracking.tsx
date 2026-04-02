import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as db from '@/lib/database';

interface MaterialItem {
  id: string;
  description: string;
  quantity_ordered: number;
  quantity_used: number;
  quantity_remaining: number;
  usage_percentage: number;
  is_overused: boolean;
  unit_price: number;
  actual_cost: number;
  planned_cost: number;
  cost_variance: number;
  unit: string;
}

interface MaterialUsageEntry {
  id: string;
  quantity_used: number;
  used_date: string;
  notes?: string;
  used_by?: string;
}

interface MaterialUsageTrackingProps {
  workOrderId: string;
  companyId: string;
  readonly?: boolean;
}

export default function MaterialUsageTracking({ 
  workOrderId, 
  companyId, 
  readonly = false 
}: MaterialUsageTrackingProps) {
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MaterialItem | null>(null);
  const [usageEntries, setUsageEntries] = useState<MaterialUsageEntry[]>([]);
  const [usageAmount, setUsageAmount] = useState('');
  const [usageNotes, setUsageNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMaterialItems();
  }, [workOrderId]);

  const loadMaterialItems = async () => {
    try {
      // This would need to be implemented in database.ts
      // For now, mock data structure
      const mockItems: MaterialItem[] = [
        {
          id: '1',
          description: 'Asphalt Shingles (30-yr architectural)',
          quantity_ordered: 30,
          quantity_used: 28,
          quantity_remaining: 2,
          usage_percentage: 93.33,
          is_overused: false,
          unit_price: 120,
          actual_cost: 3360,
          planned_cost: 3600,
          cost_variance: -240,
          unit: 'square'
        },
        {
          id: '2', 
          description: 'Roofing Nails (1-3/4")',
          quantity_ordered: 5,
          quantity_used: 7,
          quantity_remaining: -2,
          usage_percentage: 140,
          is_overused: true,
          unit_price: 18,
          actual_cost: 126,
          planned_cost: 90,
          cost_variance: 36,
          unit: 'box'
        }
      ];
      
      setMaterialItems(mockItems);
    } catch (error) {
      console.error('Failed to load material items:', error);
      toast.error('Failed to load material usage data');
    }
  };

  const loadUsageEntries = async (itemId: string) => {
    try {
      // Mock usage entries
      const mockEntries: MaterialUsageEntry[] = [
        {
          id: '1',
          quantity_used: 15,
          used_date: '2026-04-01',
          notes: 'First day installation - east side',
          used_by: 'John Smith'
        },
        {
          id: '2',
          quantity_used: 13,
          used_date: '2026-04-02', 
          notes: 'Completed west side',
          used_by: 'Mike Johnson'
        }
      ];
      
      setUsageEntries(mockEntries);
    } catch (error) {
      console.error('Failed to load usage entries:', error);
      toast.error('Failed to load usage history');
    }
  };

  const recordUsage = async () => {
    if (!selectedItem || !usageAmount) return;

    const amount = parseFloat(usageAmount);
    if (amount <= 0) {
      toast.error('Usage amount must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      // This would call the database function
      // await db.createMaterialUsageEntry({
      //   material_order_item_id: selectedItem.id,
      //   work_order_id: workOrderId,
      //   company_id: companyId,
      //   quantity_used: amount,
      //   notes: usageNotes
      // });

      toast.success(`Recorded usage of ${amount} ${selectedItem.unit}s`);
      setUsageAmount('');
      setUsageNotes('');
      await loadMaterialItems();
      await loadUsageEntries(selectedItem.id);
    } catch (error) {
      console.error('Failed to record usage:', error);
      toast.error('Failed to record material usage');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getUsageColor = (percentage: number, isOverused: boolean) => {
    if (isOverused) return 'text-red-600';
    if (percentage >= 90) return 'text-yellow-600';
    if (percentage >= 75) return 'text-blue-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage: number, isOverused: boolean) => {
    if (isOverused) return 'bg-red-500';
    if (percentage >= 90) return 'bg-yellow-500';
    if (percentage >= 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Materials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Items being tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cost Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              materialItems.reduce((sum, item) => sum + item.cost_variance, 0) > 0
                ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(materialItems.reduce((sum, item) => sum + item.cost_variance, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              vs. planned costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overused Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {materialItems.filter(item => item.is_overused).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Material Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Material Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {materialItems.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.description}</h4>
                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                      <span>Ordered: {item.quantity_ordered} {item.unit}s</span>
                      <span>Used: {item.quantity_used} {item.unit}s</span>
                      <span>Remaining: {item.quantity_remaining} {item.unit}s</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`font-medium ${getUsageColor(item.usage_percentage, item.is_overused)}`}>
                        {item.usage_percentage.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(item.cost_variance)}
                      </div>
                    </div>
                    
                    {item.is_overused && (
                      <Badge variant="destructive" className="text-xs">
                        Over
                      </Badge>
                    )}
                    
                    {!readonly && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item);
                          loadUsageEntries(item.id);
                        }}
                      >
                        Record Usage
                      </Button>
                    )}
                  </div>
                </div>

                <div className="w-full">
                  <Progress
                    value={Math.min(item.usage_percentage, 100)}
                    className="h-2"
                  />
                </div>

                {item.is_overused && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    ⚠️ This item has exceeded its planned quantity by {(item.quantity_used - item.quantity_ordered).toFixed(1)} {item.unit}s
                  </div>
                )}
              </div>
            ))}

            {materialItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No materials assigned to this work order</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Recording Modal */}
      {selectedItem && !readonly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Record Usage: {selectedItem.description}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="usage-amount">Quantity Used</Label>
                <div className="flex gap-2">
                  <Input
                    id="usage-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={usageAmount}
                    onChange={(e) => setUsageAmount(e.target.value)}
                  />
                  <span className="flex items-center text-sm text-gray-500 whitespace-nowrap">
                    {selectedItem.unit}s
                  </span>
                </div>
              </div>
              
              <div>
                <Label>Available</Label>
                <div className="text-lg font-medium pt-2">
                  {selectedItem.quantity_remaining} {selectedItem.unit}s
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="usage-notes">Notes (Optional)</Label>
              <Input
                id="usage-notes"
                placeholder="e.g., West side installation, repair work..."
                value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={recordUsage}
                disabled={loading || !usageAmount}
              >
                {loading ? 'Recording...' : 'Record Usage'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedItem(null)}
              >
                Cancel
              </Button>
            </div>

            {/* Usage History */}
            {usageEntries.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Recent Usage</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {usageEntries.map((entry) => (
                    <div key={entry.id} className="text-sm flex justify-between items-start">
                      <div>
                        <span className="font-medium">{entry.quantity_used} {selectedItem.unit}s</span>
                        <span className="text-gray-500 ml-2">{entry.used_date}</span>
                        {entry.notes && (
                          <div className="text-gray-600 text-xs mt-1">{entry.notes}</div>
                        )}
                      </div>
                      {entry.used_by && (
                        <span className="text-xs text-gray-500">{entry.used_by}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}