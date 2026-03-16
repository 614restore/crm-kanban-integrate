import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Package, Users, Wrench } from 'lucide-react';

interface JobCostingProps {
  projectId: string;
  estimatedBudget: number;
  // Estimated costs
  materialCostGoal?: number;
  subcontractorCostGoal?: number;
  salesRepPayGoal?: number;
  otherExpensesGoal?: number;
  profitMarginGoal?: number; // Percentage
  // Actual costs (real-time)
  actualMaterialCost?: number;
  actualSubcontractorCost?: number;
  actualSalesRepPay?: number;
  actualOtherExpenses?: number;
}

export function JobCostingCard({ 
  estimatedBudget,
  materialCostGoal = 0,
  subcontractorCostGoal = 0,
  salesRepPayGoal = 0,
  otherExpensesGoal = 0,
  profitMarginGoal = 20,
  actualMaterialCost = 0,
  actualSubcontractorCost = 0,
  actualSalesRepPay = 0,
  actualOtherExpenses = 0,
}: JobCostingProps) {
  
  // Calculate totals
  const totalEstimatedCosts = materialCostGoal + subcontractorCostGoal + salesRepPayGoal + otherExpensesGoal;
  const totalActualCosts = actualMaterialCost + actualSubcontractorCost + actualSalesRepPay + actualOtherExpenses;
  
  const estimatedProfit = estimatedBudget - totalEstimatedCosts;
  const actualProfit = estimatedBudget - totalActualCosts;
  
  const estimatedProfitMargin = estimatedBudget > 0 ? (estimatedProfit / estimatedBudget) * 100 : 0;
  const actualProfitMargin = estimatedBudget > 0 ? (actualProfit / estimatedBudget) * 100 : 0;
  
  const profitDifference = actualProfit - estimatedProfit;
  const isOverBudget = actualProfit < estimatedProfit;
  const isInRed = actualProfit < 0;

  // Cost line items
  const costItems = [
    {
      label: 'Materials',
      icon: Package,
      estimated: materialCostGoal,
      actual: actualMaterialCost,
      color: 'blue',
    },
    {
      label: 'Subcontractors',
      icon: Users,
      estimated: subcontractorCostGoal,
      actual: actualSubcontractorCost,
      color: 'purple',
    },
    {
      label: 'Sales Rep Pay',
      icon: DollarSign,
      estimated: salesRepPayGoal,
      actual: actualSalesRepPay,
      color: 'green',
    },
    {
      label: 'Other Expenses',
      icon: Wrench,
      estimated: otherExpensesGoal,
      actual: actualOtherExpenses,
      color: 'orange',
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`p-6 ${isInRed ? 'bg-gradient-to-r from-red-500 to-red-600' : isOverBudget ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-600'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Real-Time Job Costing</h3>
          {isInRed ? (
            <AlertTriangle size={24} className="text-white animate-pulse" />
          ) : isOverBudget ? (
            <TrendingDown size={24} className="text-white" />
          ) : (
            <TrendingUp size={24} className="text-white" />
          )}
        </div>

        {/* Profit Display */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/80 text-sm mb-1">Estimated Profit</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(estimatedProfit)}</p>
            <p className="text-white/90 text-xs mt-1">{estimatedProfitMargin.toFixed(1)}% margin</p>
          </div>
          <div>
            <p className="text-white/80 text-sm mb-1">Current Profit</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(actualProfit)}</p>
            <p className="text-white/90 text-xs mt-1">{actualProfitMargin.toFixed(1)}% margin</p>
          </div>
        </div>

        {/* Variance */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-sm">Variance from Estimate:</span>
            <span className={`text-lg font-bold ${profitDifference >= 0 ? 'text-white' : 'text-red-100'}`}>
              {profitDifference >= 0 ? '+' : ''}{formatCurrency(profitDifference)}
            </span>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Cost Breakdown</h4>
          <div className="text-xs text-gray-500">
            <span className="inline-block w-3 h-3 bg-blue-100 rounded mr-1"></span> Estimated
            <span className="inline-block w-3 h-3 bg-blue-600 rounded ml-3 mr-1"></span> Actual
          </div>
        </div>

        {costItems.map((item) => {
          const Icon = item.icon;
          const variance = item.actual - item.estimated;
          const isOver = variance > 0;
          const percentOfBudget = estimatedBudget > 0 ? (item.actual / estimatedBudget) * 100 : 0;

          return (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={`text-${item.color}-600`} />
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{formatCurrency(item.actual)}</div>
                  <div className="text-xs text-gray-500">of {formatCurrency(item.estimated)}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-6 bg-gray-100 rounded-lg overflow-hidden">
                {/* Estimated bar (light) */}
                <div
                  className={`absolute top-0 left-0 h-full bg-${item.color}-100 transition-all`}
                  style={{ width: `${Math.min((item.estimated / estimatedBudget) * 100, 100)}%` }}
                />
                {/* Actual bar (dark) */}
                <div
                  className={`absolute top-0 left-0 h-full ${isOver && item.actual > item.estimated ? 'bg-red-500' : `bg-${item.color}-600`} transition-all`}
                  style={{ width: `${Math.min(percentOfBudget, 100)}%` }}
                />
                {/* Percentage label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {percentOfBudget.toFixed(1)}% of budget
                  </span>
                </div>
              </div>

              {/* Variance */}
              {variance !== 0 && (
                <div className={`text-xs ${isOver ? 'text-red-600' : 'text-green-600'} flex items-center justify-end gap-1`}>
                  {isOver ? '↑' : '↓'} {formatCurrency(Math.abs(variance))} {isOver ? 'over' : 'under'} budget
                </div>
              )}
            </div>
          );
        })}

        {/* Totals */}
        <div className="pt-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Total Estimated Costs:</span>
            <span className="font-semibold text-gray-900">{formatCurrency(totalEstimatedCosts)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Total Actual Costs:</span>
            <span className={`font-semibold ${totalActualCosts > totalEstimatedCosts ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCurrency(totalActualCosts)}
            </span>
          </div>
          <div className="flex items-center justify-between text-base pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-900">Contract Value:</span>
            <span className="font-bold text-blue-600">{formatCurrency(estimatedBudget)}</span>
          </div>
        </div>

        {/* Alert Messages */}
        {isInRed && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-semibold text-red-900 mb-1">⚠️ Job is in the RED!</h5>
                <p className="text-xs text-red-700">
                  Current costs exceed the contract value. You are losing {formatCurrency(Math.abs(actualProfit))} on this job.
                  Review expenses immediately and consider change orders.
                </p>
              </div>
            </div>
          </div>
        )}

        {isOverBudget && !isInRed && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingDown size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-semibold text-yellow-900 mb-1">Profit Margin Reduced</h5>
                <p className="text-xs text-yellow-700">
                  Actual costs are {formatCurrency(Math.abs(profitDifference))} higher than estimated.
                  Monitor remaining expenses closely to protect profitability.
                </p>
              </div>
            </div>
          </div>
        )}

        {!isOverBudget && actualProfit > 0 && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-semibold text-green-900 mb-1">On Track for Profit!</h5>
                <p className="text-xs text-green-700">
                  Job is performing {formatCurrency(profitDifference)} better than estimated.
                  Current profit margin: {actualProfitMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
