import React from 'react';
import PhysicalOverall from './PhysicalOverall'; // Import the PhysicalOverall component
import Floorplan from './Floorplan'; // Import the Floorplan component
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Ruler, Maximize2, Square } from 'lucide-react';
import physicalData from './PhysicalValue.json';

function PhysicalView({ onShowInterior }) {
  const building = physicalData[0]; // Assuming you want to display the first building's data

  const physicalMetrics = [
    {
      metric: 'Floor Depth',
      actual: 42,
      target: 45,
      score: 93,
      impact: 'Optimal for unit layouts',
      icon: Square
    },
    {
      metric: 'Window Line',
      actual: 95,
      target: 85,
      score: 112,
      impact: 'Excellent natural light',
      icon: Maximize2
    },
    {
      metric: 'Ceiling Height',
      actual: 12.2,
      target: 11.5,
      score: 106,
      impact: 'Above minimum requirement',
      icon: Ruler
    }
  ];

  const handleShowInterior = () => {
    if (onShowInterior) {
      console.log("Show Interior button clicked");
      onShowInterior();
    }
  };

  return (
    <div className="bg-black text-white p-2 mt-6 rounded-lg">
      {/* Render the PhysicalOverall component */}
      <PhysicalOverall />

      {/* Render the Floorplan component */}
      <Floorplan />

      {/* Physical Match Metrics Section */}
      <h3 className="text-xl font-bold mb-6 mt-6">Physical Conversion Metrics</h3>
      
      <div className="grid grid-cols-3 gap-2 mb-8">
        {physicalMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.metric} className="bg-gray-800 p-4 rounded">
              <div className="flex items-center space-x-2 mb-3">
                <Icon className="w-5 h-5 text-red-500" />
                <span className="text-sm text-gray-400">{item.metric}</span>
              </div>
              <div className="text-2xl font-bold mb-1">
                {item.actual}{item.metric === 'Window Line' ? '%' : 'ft'}
              </div>
              <div className="text-sm text-gray-400">
                Target: {item.target}{item.metric === 'Window Line' ? '%' : 'ft'}
              </div>
              <div className="mt-6 text-sm text-gray-300">{item.impact}</div>
            </div>
          );
        })}
      </div>
      <div className="h-48 mr-10 mt-14 mb-10 ">
        <ResponsiveContainer width="100%" height="120%">
          <BarChart data={physicalMetrics}>
            <XAxis dataKey="metric" />
            <YAxis domain={[0, 120]} />
            <Tooltip 
              content={({ payload, label }) => {
                if (!payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-gray-900 p-3 rounded border border-gray-700">
                    <div className="font-bold mb-2">{label}</div>
                    <div className="text-sm">
                      Actual: {data.actual}{data.metric === 'Window Line' ? '%' : 'ft'}<br />
                      Target: {data.target}{data.metric === 'Window Line' ? '%' : 'ft'}<br />
                      Score: {data.score}%
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="score"
              fill="#ef4444"
              background={{ fill: '#374151' }}
              label={{ position: 'top', fill: '#fff' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <button onClick={handleShowInterior} className="bg-red-500 text-white p-2 rounded">
        Show Interior
      </button>
    </div>
  );
}

export default PhysicalView;
