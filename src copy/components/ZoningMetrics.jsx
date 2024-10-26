import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Building, ArrowUpRight, Clock } from 'lucide-react';

const ZoningMetrics = () => {
  console.log("ZoningMetrics component rendered");

  const zoningData = {
    far: { current: 15, base: 12, bonus: 3 },
    height: { current: 150, limit: 160, utilized: 93.75 },
    housing: {
      total: 150,
      affordable: 30,
      minSize: 450,
      avgSize: 725
    },
    timeline: [
      { phase: "Fast Track Review", duration: 2 },
      { phase: "Zoning Approval", duration: 3 },
      { phase: "Building Permit", duration: 4 },
      { phase: "Construction", duration: 14 }
    ]
  };

  const densityMetrics = [
    { category: "Base FAR", value: 12 },
    { category: "Affordable Housing Bonus", value: 2 },
    { category: "TDR Bonus", value: 1 },
    { category: "Total FAR", value: 15 }
  ];

  return (
    <div className="bg-black text-white p-6 rounded-lg">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">FAR Achieved</span>
            <Building className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold">15.0</div>
          <div className="text-sm text-green-500">+3.0 Bonus</div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Affordable Units</span>
            <ArrowUpRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">20%</div>
          <div className="text-sm text-blue-500">30 Units</div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Fast Track</span>
            <Clock className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold">12-18</div>
          <div className="text-sm text-gray-400">Months</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-sm text-gray-400 mb-4">Density Bonus Breakdown</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={densityMetrics}>
                <XAxis dataKey="category" />
                <YAxis domain={[0, 16]} />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-sm text-gray-400 mb-4">Unit Mix Analysis</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between">
                <span>Minimum Size</span>
                <span>{zoningData.housing.minSize} SF</span>
              </div>
              <div className="h-2 bg-gray-700 rounded mt-1">
                <div className="h-2 bg-red-500 rounded" style={{width: '100%'}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between">
                <span>Average Size</span>
                <span>{zoningData.housing.avgSize} SF</span>
              </div>
              <div className="h-2 bg-gray-700 rounded mt-1">
                <div className="h-2 bg-red-500 rounded" style={{width: '85%'}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between">
                <span>Height Used</span>
                <span>{zoningData.height.utilized}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded mt-1">
                <div className="h-2 bg-red-500 rounded" style={{width: `${zoningData.height.utilized}%`}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-gray-800 p-4 rounded">
        <h4 className="text-sm text-gray-400 mb-4">Approval Timeline</h4>
        <div className="flex justify-between">
          {zoningData.timeline.map((phase, index) => (
            <div key={phase.phase} className="flex flex-col items-center">
              <div className="text-sm text-gray-400">{phase.phase}</div>
              <div className="text-xl font-bold">{phase.duration}mo</div>
              {index < zoningData.timeline.length - 1 && (
                <div className="h-0.5 w-full bg-red-500 mt-2"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ZoningMetrics;
