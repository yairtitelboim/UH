import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Ruler, Building } from 'lucide-react';
import physicalData from './PhysicalValue.json';

function PhysicalView() {
  const building = physicalData[0]; // Assuming you want to display the first building's data

  const architecturalDetails = [
    { feature: 'Style', value: building.details.architectural.style },
    { feature: 'Materials', value: building.details.architectural.materials.join(', ') },
    { feature: 'Window Pattern', value: building.details.architectural.window_pattern },
    { feature: 'Window Count', value: building.details.architectural.window_count },
  ];

  const notableFeatures = building.details.architectural.notable_features.map((feature, index) => ({
    feature: `Feature ${index + 1}`,
    value: feature,
  }));

  return (
    <div className="bg-black text-white p-6 rounded-lg">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Size</span>
            <Ruler className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold">{building.details.physical_characteristics.size}</div>
          <div className="text-sm text-green-500">Stories: {building.details.physical_characteristics.stories}</div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Ceiling Height</span>
            <Building className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{building.details.physical_characteristics.ceiling_height}</div>
          <div className="text-sm text-blue-500">Floor Plate: {building.details.physical_characteristics.floor_plate}</div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Window Line</span>
          </div>
          <div className="text-2xl font-bold">{building.details.physical_characteristics.window_line}</div>
          <div className="text-sm text-red-500">Window Count: {building.details.architectural.window_count}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-sm text-gray-400 mb-4">Architectural Details</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={architecturalDetails}>
                <XAxis dataKey="feature" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-sm text-gray-400 mb-4">Notable Features</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={notableFeatures}>
                <XAxis dataKey="feature" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhysicalView;
