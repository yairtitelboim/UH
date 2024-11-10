import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';

const DCFAnalysis = () => {
  const cashflows = {
    development: {
      Q1_2024: { costs: -28500000, revenue: 0, milestones: 'Demo/Abatement' },
      Q2_2024: { costs: -32000000, revenue: 0, milestones: 'Core/Shell Start' },
      Q3_2024: { costs: -35000000, revenue: 0, milestones: 'MEP Rough' },
      Q4_2024: { costs: -38000000, revenue: 0, milestones: 'Window Wall' }
    },
    conversion: {
      Q1_2025: { costs: -22000000, revenue: 0, milestones: 'Interior Build' },
      Q2_2025: { costs: -18000000, revenue: 0, milestones: 'Unit Finishes' },
      Q3_2025: { costs: -12000000, revenue: 450000, milestones: 'TCO Floor 2-6' },
      Q4_2025: { costs: -8000000, revenue: 850000, milestones: 'TCO Floor 7-12' }
    },
    stabilization: {
      Q1_2026: { costs: -2000000, revenue: 1850000, occupancy: 45, absorption: 35 },
      Q2_2026: { costs: -1200000, revenue: 2750000, occupancy: 65, absorption: 25 },
      Q3_2026: { costs: -800000, revenue: 3450000, occupancy: 82, absorption: 18 },
      Q4_2026: { costs: -500000, revenue: 3950000, occupancy: 92, absorption: 12 }
    },
    stabilized: {
      Q1_2027: { revenue: 4250000, opex: -1200000, noi: 3050000 },
      Q2_2027: { revenue: 4300000, opex: -1225000, noi: 3075000 },
      Q3_2027: { revenue: 4350000, opex: -1250000, noi: 3100000 },
      Q4_2027: { revenue: 4400000, opex: -1275000, noi: 3125000 }
    }
  };

  const quarterlyMetrics = [
    ...Object.entries(cashflows.development).map(([quarter, data]) => ({
      quarter,
      costs: data.costs,
      revenue: data.revenue,
      netCashflow: data.revenue + data.costs,
      milestone: data.milestones,
      phase: 'Development'
    })),
    ...Object.entries(cashflows.conversion).map(([quarter, data]) => ({
      quarter,
      costs: data.costs,
      revenue: data.revenue,
      netCashflow: data.revenue + data.costs,
      milestone: data.milestones,
      phase: 'Conversion'
    })),
    ...Object.entries(cashflows.stabilization).map(([quarter, data]) => ({
      quarter,
      costs: data.costs,
      revenue: data.revenue,
      netCashflow: data.revenue + data.costs,
      occupancy: data.occupancy,
      absorption: data.absorption,
      phase: 'Stabilization'
    })),
    ...Object.entries(cashflows.stabilized).map(([quarter, data]) => ({
      quarter,
      costs: -data.opex,
      revenue: data.revenue,
      netCashflow: data.noi,
      phase: 'Stabilized'
    }))
  ];
  const MetricCard = ({ title, value, subValue, trend }) => (
    <div className="bg-gray-900 p-3 rounded-lg">
      <div className="text-sm text-gray-400 mb-3">{title}</div>
      
      <div className="text-lg font-bold mb-2">{value}</div>
      
      <div className="flex flex-col">
        {subValue && (
          <div className="text-sm text-gray-500 mb-1">{subValue}</div>
        )}
        {trend && (
          <div className={`flex items-center ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="text-sm ml-1">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-black text-white p-3 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Analysis</h2>
          <p className="text-gray-400">Q1 2024 - Q4 2027</p>
        </div>
        <div className="flex gap-2">
          <div className="text-right">
            <div className="text-sm text-gray-400">Total Cost</div>
            <div className="text-xl font-bold text-red-400">$198.5M</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Stabilized NOI</div>
            <div className="text-xl font-bold text-green-400">$12.4M</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-4 gap-2">
          <MetricCard 
            title="Development Yield"
            value="5.8%"
            subValue="on cost"
            trend={0.3}
          />
          <MetricCard 
            title="Stabilized Value"
            value="$248M"
            subValue="@ 5.0% cap"
            trend={2.5}
          />
          <MetricCard 
            title="Peak & Equity"
            value="$86M"
            subValue="Q4 2024"
            trend={-1.2}
          />
          <MetricCard 
            title="IRR Base Case"
            value="15.5%"
            subValue="unlevered"
            trend={0.8}
          />
        </div>
        {/* Quarterly Cash Flows */}
        <div className="bg-gray-900 p-2 rounded-lg">
          <h3 className="text-sm font-medium mb-4">Quarterly Cash Flows</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlyMetrics}>
                <XAxis 
                  dataKey="quarter" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${Math.abs(value/1000000)}M`}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-gray-800 p-3 rounded border border-gray-700">
                        <div className="font-medium mb-1">{label}</div>
                        <div className="text-sm space-y-1">
                          <div>Revenue: ${(data.revenue/1000000).toFixed(1)}M</div>
                          <div>Costs: ${(data.costs/1000000).toFixed(1)}M</div>
                          <div>Net: ${(data.netCashflow/1000000).toFixed(1)}M</div>
                          {data.milestone && <div>Milestone: {data.milestone}</div>}
                          {data.occupancy && <div>Occupancy: {data.occupancy}%</div>}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" fill="#22c55e" />
                <Bar dataKey="costs" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 gap-2">
          <div className="bg-gray-900 p-2 rounded-lg">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              Development Phase
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Hard Costs
                </span>
                <span>$148.2M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Soft Costs
                </span>
                <span>$35.8M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Financing
                </span>
                <span>$14.5M</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Total
                </span>
                <span>$198.5M</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-2 rounded-lg">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Stabilization
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Rental Revenue
                </span>
                <span>$17.3M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Other Income
                </span>
                <span>$1.8M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Operating Expenses
                </span>
                <span>($6.7M)</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  NOI
                </span>
                <span>$12.4M</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-2 rounded-lg">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-400" />
              Returns
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Development Yield
                </span>
                <span>5.8%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Exit Cap Rate
                </span>
                <span>5.0%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Value Creation
                </span>
                <span>+25%</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Profit
                </span>
                <span>$49.5M</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DCFAnalysis;
