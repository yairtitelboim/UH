import React, { useEffect, useRef, useCallback, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line, Legend, PieChart, Pie } from 'recharts';
import { MOCK_RESPONSES, parseClaudeResponse, LOADING_STEPS } from '../../services/claude';
import { stopGEOIDAnimation, initializeParticleLayers, transitionToGridView } from './hooks/mapAnimations';
import mapboxgl from 'mapbox-gl';

// Styled components from index.jsx
const Panel = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 35%;
  background: #1A1A1A;
  color: white;
  display: flex;
  flex-direction: column;
  z-index: 1;
`;

const ChatHeader = styled.div`
  padding: 20px;
  font-size: 24px;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const ChatMessages = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding: 20px;
`;

const Message = styled.div`
  margin-bottom: 24px;
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2A2A2A;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Sender = styled.div`
  font-size: 18px;
  font-weight: 500;
`;

const MessageContent = styled.div`
  font-size: 16px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
`;

const InputArea = styled.div`
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const Input = styled.input`
  width: 100%;
  padding: 16px;
  background: #2A2A2A;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 16px;
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const InitialPrompt = styled.div`
  text-align: center;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 40px;
  padding: 0 20px;
`;

const QuestionButton = styled.button`
  width: 95%;
  margin: 10px auto;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  color: white;
  font-size: 18px;
  text-align: left;
  cursor: pointer;
  display: block;
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;

const FollowUpButton = styled(QuestionButton)`
  margin-top: 10px;
  padding: 12px;
  font-size: 16px;
  opacity: 0.8;
  &:hover {
    opacity: 1;
  }
`;

const SeeMoreButton = styled(QuestionButton)`
  background: rgba(255, 69, 0, 0.15);  // Using #FF4500 (the orange) with transparency
  border: 1px solid rgba(255, 69, 0, 0.3);
  
  &:hover {
    background: rgba(255, 69, 0, 0.25);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const AnimatedDiv = styled.div`
  margin-bottom: 12px;
  opacity: 0;
  animation: ${fadeIn} 0.5s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
`;

// Add these styled components
const StatsContainer = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
`;

const StatsTitle = styled.div`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const GraphTitle = styled.span`
  font-weight: 600;
  margin-top: 2px;
`;

// Add new styled component for the data source
const DataSource = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  max-width: 200px;
  text-align: right;
`;

// Updated data for energy consumption
const areaComparisonData = [
  {
    year: '2020',
    brickell: 720,
    southBeach: 680,
    miami: 650,
    us: 600,
    name: '2020'
  },
  {
    year: '2021',
    brickell: 785,
    southBeach: 710,
    miami: 680,
    us: 620,
    name: '2021'
  },
  {
    year: '2022',
    brickell: 850,
    southBeach: 760,
    miami: 720,
    us: 650,
    name: '2022'
  },
  {
    year: '2023',
    brickell: 920,
    southBeach: 830,
    miami: 780,
    us: 690,
    name: '2023'
  },
  {
    year: '2024',
    brickell: 980,
    southBeach: 890,
    miami: 840,
    us: 730,
    name: '2024'
  },
  {
    year: '2025',
    brickell: 1050,
    southBeach: 960,
    miami: 900,
    us: 780,
    name: '2025'
  }
];

// Update the data to show infrastructure metrics
const brickellData = [
  { name: 'Smart Grid', value: 45 },
  { name: 'Renewable', value: 28 },
  { name: 'Traditional', value: 15 },
  { name: 'Backup', value: 12 }
];

// Add these new styled components
const GraphLoadingContainer = styled.div`
  height: 200px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const LoadingText = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  z-index: 1;
`;

const LoadingShimmer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
  animation: shimmer 1.5s infinite;

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
`;

// Add new data for area comparison
const areaEnergyData = [
  {
    metric: 'Peak Demand (MW)',
    Brickell: 850,
    SouthBeach: 720,
    Wynwood: 580
  },
  {
    metric: 'Base Supply (MW)',
    Brickell: 920,
    SouthBeach: 780,
    Wynwood: 650
  },
  {
    metric: 'Grid Capacity',
    Brickell: 1100,
    SouthBeach: 900,
    Wynwood: 750
  },
  {
    metric: 'Renewable Share',
    Brickell: 280,
    SouthBeach: 220,
    Wynwood: 190
  }
];

// Create separate components for each graph type
const ComparisonGraph = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <StatsContainer>
        <StatsTitle>
          <span>Energy Consumption Activity (2020-2025)</span>
          <DataSource>Based on FPL Grid Data & Energy Forecasts</DataSource>
        </StatsTitle>
        <GraphLoadingContainer>
          <LoadingText>Loading visualization...</LoadingText>
          <LoadingShimmer />
        </GraphLoadingContainer>
      </StatsContainer>
    );
  }

  return (
    <>
      <StatsContainer>
        <StatsTitle>
          <span>Energy Consumption Activity (2020-2025)</span>
          <DataSource>Based on FPL Grid Data & Energy Forecasts</DataSource>
        </StatsTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart 
            data={areaComparisonData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis 
              dataKey="year" 
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              domain={[0, 100]}
              width={25}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
                padding: '8px 12px'
              }}
              formatter={(value) => [`${value}`, 'Index']}
              labelStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}
            />
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)"
              vertical={false}
            />
            <Legend 
              verticalAlign="top"
              height={36}
              content={({ payload }) => (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '16px',
                  marginBottom: '8px',
                  fontSize: '11px'
                }}>
                  {payload.map((entry, index) => (
                    <div 
                      key={`legend-${index}`}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}
                    >
                      <span style={{ 
                        display: 'inline-block',
                        width: '12px',
                        height: '2px',
                        background: entry.color,
                        ...(entry.value === 'US Average' && { 
                          borderTop: '1px dashed ' + entry.color,
                          background: 'transparent'
                        })
                      }} />
                      <span>{entry.value}</span>
                    </div>
                  ))}
                </div>
              )}
            />
            <Line 
              type="monotone"
              dataKey="brickell" 
              name="Brickell" 
              stroke="#FF4500"
              strokeWidth={2}
              dot={{ fill: '#FF4500', stroke: '#FF4500', r: 3 }}
              activeDot={{ r: 5, stroke: '#FF4500', strokeWidth: 2 }}
            />
            <Line 
              type="monotone"
              dataKey="southBeach" 
              name="South Beach" 
              stroke="#FF8C00"
              strokeWidth={2}
              dot={{ fill: '#FF8C00', stroke: '#FF8C00', r: 3 }}
              activeDot={{ r: 5, stroke: '#FF8C00', strokeWidth: 2 }}
            />
            <Line 
              type="monotone"
              dataKey="miami" 
              name="Miami Metro" 
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth={1.5}
              dot={{ fill: 'rgba(255, 255, 255, 0.6)', stroke: 'rgba(255, 255, 255, 0.6)', r: 2 }}
              activeDot={{ r: 4, stroke: 'rgba(255, 255, 255, 0.6)', strokeWidth: 2 }}
            />
            <Line 
              type="monotone"
              dataKey="us" 
              name="US Average" 
              stroke="rgba(255, 255, 255, 0.3)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={{ fill: 'rgba(255, 255, 255, 0.3)', stroke: 'rgba(255, 255, 255, 0.3)', r: 2 }}
              activeDot={{ r: 4, stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255, 255, 255, 0.5)', 
          marginTop: '12px',
          padding: '0 8px'
        }}>
          * Index combines business activity, property values, and tourism metrics
        </div>
      </StatsContainer>

      <StatsContainer>
        <StatsTitle>
          <GraphTitle>District Energy Comparison</GraphTitle>
          <DataSource>FPL Grid Analysis 2024</DataSource>
        </StatsTitle>
        <div style={{ 
          fontSize: '14px', 
          color: 'rgba(255, 255, 255, 0.7)', 
          marginBottom: '16px',
          lineHeight: '1.4'
        }}>
          Comparison of key energy metrics across Miami's major districts, showing current demand, supply capacity, and renewable integration levels.
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart 
            data={areaEnergyData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            layout="vertical"
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)"
              horizontal={false}
            />
            <XAxis 
              type="number"
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              dataKey="metric"
              type="category"
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              width={100}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                fontSize: '12px',
                padding: '8px 12px'
              }}
              formatter={(value) => [`${value} MW`]}
              labelStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}
            />
            <Legend 
              verticalAlign="top"
              height={36}
              wrapperStyle={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            />
            <Bar 
              dataKey="Brickell" 
              fill="#FF4500" 
              name="Brickell"
              radius={[0, 4, 4, 0]}
            />
            <Bar 
              dataKey="SouthBeach" 
              fill="#FF8C00" 
              name="South Beach"
              radius={[0, 4, 4, 0]}
            />
            <Bar 
              dataKey="Wynwood" 
              fill="#FFA07A" 
              name="Wynwood"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255, 255, 255, 0.5)', 
          marginTop: '12px',
          padding: '0 8px'
        }}>
          * Based on current grid infrastructure and usage patterns
        </div>
      </StatsContainer>
    </>
  );
};

// Update the power trend data to match the style
const powerTrendData = [
  { time: '00:00', load: 450, renewable: 120, predicted: 440 },
  { time: '04:00', load: 380, renewable: 80, predicted: 390 },
  { time: '08:00', load: 720, renewable: 280, predicted: 700 },
  { time: '12:00', load: 850, renewable: 320, predicted: 830 },
  { time: '16:00', load: 780, renewable: 290, predicted: 790 },
  { time: '20:00', load: 680, renewable: 180, predicted: 670 },
  { time: '23:59', load: 520, renewable: 150, predicted: 510 }
];

const BrickellGraph = () => {
  return (
    <>
      <StatsContainer>
        <StatsTitle>
          <GraphTitle>Power Distribution Network</GraphTitle>
          <DataSource>FPL Grid Data 2023</DataSource>
        </StatsTitle>
        <div style={{ 
          fontSize: '14px', 
          color: 'rgba(255, 255, 255, 0.7)', 
          marginBottom: '16px',
          lineHeight: '1.4'
        }}>
          This breakdown shows the distribution of power infrastructure nodes across Brickell's network. Smart grid components represent the majority, followed by renewable energy installations and traditional power delivery systems.
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart 
            data={brickellData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              width={25}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                fontSize: '12px',
                padding: '8px 12px'
              }}
              formatter={(value) => [`${value} nodes`]}
              labelStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}
            />
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)"
              vertical={false}
            />
            <Bar 
              dataKey="value" 
              fill="#FF4500"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255, 255, 255, 0.5)', 
          marginTop: '12px',
          padding: '0 8px'
        }}>
          * Based on latest infrastructure survey and smart meter data
        </div>
      </StatsContainer>

      <StatsContainer>
        <StatsTitle>
          <GraphTitle>24hr Power Consumption (MW)</GraphTitle>
          <DataSource>Live Grid Metrics + AI Forecast</DataSource>
        </StatsTitle>
        <div style={{ 
          fontSize: '14px', 
          color: 'rgba(255, 255, 255, 0.7)', 
          marginBottom: '16px',
          lineHeight: '1.4'
        }}>
          This graph shows real-time power consumption patterns across Brickell's grid network. The orange line represents total load, while green shows renewable energy contribution. The blue dashed line indicates AI-predicted demand for optimal resource allocation.
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart 
            data={powerTrendData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis 
              dataKey="time" 
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              width={25}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                fontSize: '12px',
                padding: '8px 12px'
              }}
              formatter={(value, name) => [
                `${value} MW`, 
                name === 'load' ? 'Total Load' : 
                name === 'renewable' ? 'Renewable' : 
                'AI Predicted'
              ]}
              labelStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}
            />
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(255, 255, 255, 0.05)"
              vertical={false}
            />
            <Line 
              type="monotone" 
              dataKey="load" 
              name="Total Load"
              stroke="#FF4500" 
              strokeWidth={1.5}
              dot={{ fill: '#FF4500', r: 2 }}
              activeDot={{ r: 4, stroke: '#FF4500', strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="renewable" 
              name="Renewable"
              stroke="#4CAF50" 
              strokeWidth={1.5}
              dot={{ fill: '#4CAF50', r: 2 }}
              activeDot={{ r: 4, stroke: '#4CAF50', strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="predicted" 
              name="AI Predicted"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={{ fill: 'rgba(255, 255, 255, 0.3)', r: 2 }}
              activeDot={{ r: 4, stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 }}
            />
            <Legend 
              verticalAlign="top" 
              height={36}
              wrapperStyle={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255, 255, 255, 0.5)', 
          marginTop: '12px',
          padding: '0 8px'
        }}>
          * Data updates every 5 minutes with real-time grid measurements
        </div>
      </StatsContainer>
    </>
  );
};

const LoadingMessage = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  color: rgba(255, 255, 255, 0.7);
`;

const LoadingStep = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 0;
  transform: translateY(10px);
  animation: ${fadeIn} 0.3s ease-out forwards;
  animation-delay: ${props => props.$delay}ms;

  .icon {
    font-size: 16px;
    min-width: 24px;
  }

  .text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }

  .dots {
    color: rgba(255, 255, 255, 0.4);
    animation: loadingDots 1.4s infinite;
  }
`;

const loadingDots = keyframes`
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
`;

const QuickActionsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

const QuickActionButton = styled.button`
  flex: 1;
  background: rgba(255, 69, 0, 0.1);
  border: 1px solid rgba(255, 69, 0, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 0; // Allows flex shrinking

  &:hover {
    background: rgba(255, 69, 0, 0.15);
    border-color: rgba(255, 69, 0, 0.3);
  }

  .icon {
    color: rgb(255, 69, 0);
    font-size: 16px;
    margin-bottom: 4px;
  }

  .text {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .description {
    display: none; // Hide description for compact view
  }
`;

// Add new styled components at the top
const ModelSelector = styled.div`
  position: relative;
  display: inline-block;
`;

const ModelToggle = styled.button`
  background: rgba(255, 69, 0, 0.1);
  border: 1px solid rgba(255, 69, 0, 0.2);
  border-radius: 4px;
  color: #FF4500;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 69, 0, 0.15);
  }

  &:after {
    content: '▼';
    font-size: 8px;
    margin-left: 4px;
  }
`;

const ModelDropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 69, 0, 0.2);
  border-radius: 4px;
  overflow: hidden;
  z-index: 1000;
  display: ${props => props.$isOpen ? 'block' : 'none'};
`;

const ModelOption = styled.div`
  padding: 8px 16px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 69, 0, 0.15);
  }

  ${props => props.$isSelected && `
    background: rgba(255, 69, 0, 0.1);
    color: #FF4500;
  `}
`;

const AIChatPanel = ({ messages, setMessages, handleQuestion, map }) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isGeoIDVisible, setIsGeoIDVisible] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Claude');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Define available models with their versions
  const availableModels = [
    'Claude-3 Opus',
    'Claude-3 Sonnet',
    'Claude-2.1',
    'GPT-4 Turbo',
    'GPT-4',
    'GPT-3.5 Turbo',
    'Gemini Pro',
    'Gemini Ultra',
    'DeepSeek Chat',
    'DeepSeek Coder',
    'Llama-2 70B',
    'Mixtral 8x7B',
    'Code Llama 34B',
    'Yi-34B Chat'
  ];

  const handleInitialQuestion = async (question) => {
    // Set loading state first
    setIsLoading(true);


    // Add a longer delay (2.5 seconds) to show the loading animation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Process the question - let handleQuestion manage the message adding
    const response = await handleQuestion(question);

    // Turn off loading state
    setIsLoading(false);
  };

  const processQuestionResponse = async (question) => {
    console.log('🎯 processQuestionResponse called with:', question);
    
    // Add special handling for the high-energy zones question
    if (question === "Find high-energy, high-connectivity zones in Miami") {
      // Show loading steps
      setMessages(prevMessages => [...prevMessages, {
        isUser: true,
        content: question
      }]);
      
      setIsLoading(true);
      
      // Brief loading animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Add loading message
      const loadingSteps = [
        {
          icon: "🗺️",
          text: "Analyzing energy consumption patterns...",
          delay: 300
        },
        {
          icon: "📡",
          text: "Scanning connectivity infrastructure...",
          delay: 600
        },
        {
          icon: "📊",
          text: "Processing urban density metrics...",
          delay: 900
        }
      ];

      for (const step of loadingSteps) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }

      setIsLoading(false);

      // Continue with original response handling
      const response = await handleQuestion(question);
      return response;
    }

    try {
        // First, stop any existing animations
        if (map.current) {
            console.log('🛑 Stopping existing animations');
            stopGEOIDAnimation(map.current);
        }

        // Get response from Claude
        const response = await handleQuestion(question);
        console.log('📍 Claude response:', response);

        // Handle grid view transitions first
        if (question.includes('SHOW_BRICKELL_DINING') || 
            question.includes('SHOW_BRICKELL_GRID') || 
            question.includes('EXPLORE_GRID') ||
            response?.poiInfo?.poiTypes?.includes('substation') || 
            response?.poiInfo?.poiTypes?.includes('transformer')) {
            
            console.log('🔌 Power infrastructure query detected');
            if (map.current) {
                console.log('🔄 Transitioning to grid view');
                await transitionToGridView(map.current);
            }
        }

        // Then handle navigation if coordinates are present
        if (response?.action === 'navigate' && response.coordinates && response.zoomLevel && map.current) {
            console.log('🎯 Navigating to coordinates:', response.coordinates);
            map.current.flyTo({
                center: response.coordinates,
                zoom: response.zoomLevel,
                duration: 2000
            });
        }

        return response;
    } catch (error) {
        console.error('❌ Error in processQuestionResponse:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      processQuestionResponse(inputValue);
      setInputValue('');
    }
  };

  // Auto-scroll effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update handleQuickAction to use handleQuestion instead
  const handleQuickAction = async (action) => {
    if (action.prompt === 'VIEW_TRANSFORMER_CAPACITY') {
      // Get the mock response directly from MOCK_RESPONSES
      const mockResponse = MOCK_RESPONSES[action.prompt];

      // Parse the mock response
      const parsedResponse = parseClaudeResponse(mockResponse);

      // Add the parsed response to the messages
      setMessages(prevMessages => [...prevMessages, {
        isUser: false,
        content: parsedResponse
      }]);

      return;
    }

    if (action.prompt === 'SHOW_SUBSTATION_NETWORK') {
      // Show the popup with "Hello" text
      setShowPopup(true);
      return;
    }

    if (action.prompt === 'SHOW_FUTURE_TRENDS') {
        setIsLoading(true);
        
        // Add artificial delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockResponse = {
            isUser: false,
            content: {
                text: "Here's our AI forecast for Brickell's energy infrastructure needs:",
                action: 'showGraphs',
                graphs: [
                    {
                        data: [
                            { year: '2024-Q1', capacity: 850, smart: 880, baseline: 820 },
                            { year: '2024-Q2', capacity: 900, smart: 950, baseline: 850 },
                            { year: '2024-Q3', capacity: 950, smart: 1020, baseline: 880 },
                            { year: '2024-Q4', capacity: 1000, smart: 1100, baseline: 910 }
                        ]
                    },
                    {
                        data: [
                            { year: '2024-Q1', capacity: 45, smart: 52, baseline: 40 },
                            { year: '2024-Q2', capacity: 48, smart: 56, baseline: 42 },
                            { year: '2024-Q3', capacity: 52, smart: 62, baseline: 44 },
                            { year: '2024-Q4', capacity: 55, smart: 65, baseline: 46 }
                        ]
                    }
                ],
                postText: "The blue lines show projected energy demand under different growth scenarios."
            }
        };
        
        setMessages(prevMessages => [...prevMessages, mockResponse]);
        setIsLoading(false);
        return;
    }
    
    // Special handling for graph-only actions
    if (action.prompt === 'SHOW_GRID_GROWTH' || action.prompt === 'COMPARE_GRID_METRICS') {
        const response = await handleQuestion(action.prompt);
        const content = JSON.parse(response.content[0].text);
        
        // Directly add just the graphs to messages
        setMessages(prevMessages => [...prevMessages, {
            isUser: false,
            content: {
                action: 'showGraphs',
                graphs: content.graphs
            }
        }]);
        return;
    }
    
    if (action.prompt === 'SHOW_GRID_DENSITY') {
      const response = await handleQuestion(action.prompt);
      const parsedResponse = parseClaudeResponse(response);
      
      // Add zoom out button to the response
      const enhancedResponse = {
        ...parsedResponse,
        zoomOutButton: {
          text: "View grid performance",
          action: "zoomOut"
        }
      };

      setMessages(prevMessages => [...prevMessages, {
        isUser: false,
        content: enhancedResponse
      }]);
      return;
    }
    
    // Handle other actions as before
    const response = await handleQuestion(action.prompt);
    const parsedResponse = parseClaudeResponse(response);
    setMessages(prevMessages => [...prevMessages, {
      isUser: false,
      content: parsedResponse
    }]);
  };

  return (
    <Panel>
      <ChatHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <span style={{ color: '#666', fontSize: '14px', fontWeight: 500 }}>Chat with</span>
            <span style={{ color: '#FF4500', fontSize: '14px', fontWeight: 600, marginLeft: '4px' }}>ATLAS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ModelSelector>
              <ModelToggle onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}>
                {selectedModel}
              </ModelToggle>
              <ModelDropdown $isOpen={isModelDropdownOpen}>
                {availableModels.map(model => (
                  <ModelOption
                    key={model}
                    $isSelected={selectedModel === model}
                    onClick={() => {
                      setSelectedModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                  >
                    {model}
                  </ModelOption>
                ))}
              </ModelDropdown>
            </ModelSelector>
            <span style={{ 
              color: '#ffffff', 
              fontSize: '12px', 
              fontWeight: 600,
              backgroundColor: '#FF4500',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>v0.1</span>
          </div>
        </div>
      </ChatHeader>
      
      <ChatMessages>
        {messages.length === 0 ? (
          <>
            <InitialPrompt>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>
                Ask me about Miami's <span style={{  fontWeight: 800 }}>power grid</span>, <span style={{ fontWeight: 800 }}>infrastructure</span>, and <span style={{  fontWeight: 800 }}>urban development</span> patterns.
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 300 }}>
                I can help you analyze energy consumption, digital connectivity, and smart city initiatives.
              </div>
            </InitialPrompt>
            
            <AnimatedDiv $delay={0.2}>
              <QuestionButton onClick={() => handleInitialQuestion("Find high-energy, high-connectivity zones in Miami")}>
                Find high-energy, high-connectivity zones in Miami
              </QuestionButton>
            </AnimatedDiv>

            <AnimatedDiv $delay={0.4}>
              <QuestionButton onClick={() => handleQuestion("Which areas show the highest population growth?")}>
                Which areas show the highest population growth?
              </QuestionButton>
            </AnimatedDiv>

            <AnimatedDiv $delay={0.6}>
              <QuestionButton onClick={() => handleQuestion("Find neighborhoods with the best residential-commercial mix")}>
                Find neighborhoods with the best residential-commercial mix
              </QuestionButton>
            </AnimatedDiv>

            <AnimatedDiv $delay={0.8}>
              <SeeMoreButton onClick={() => handleQuestion("Show me more options")}>
                See more
              </SeeMoreButton>
            </AnimatedDiv>
          </>
        ) : (
          <>
            {messages.map((msg, i) => {
              console.log('Rendering message:', msg); // Debug log
              console.log('Is latest message:', msg === messages[messages.length - 1]); // Debug log
              
              return (
                <Message key={i}>
                  <MessageHeader>
                    <Avatar />
                    <Sender>{msg.isUser ? 'You' : 'ATLAS'}</Sender>
                  </MessageHeader>
                  <MessageContent>
                    {msg.isUser ? (
                      msg.content
                    ) : (
                      <>
                        {/* Add debug logs */}
                        {console.log('Message content:', msg.content)}
                        {console.log('Quick actions:', msg.content?.quickActions)}
                        
                        {/* Show quick actions if they exist */}
                        {msg.content?.quickActions && (
                          <QuickActionsContainer>
                            {msg.content.quickActions.map((action, index) => {
                              // Replace emoji icons with monochrome symbols
                              const icon = {
                                "📊": "◉", // Demographics
                                "📈": "↗", // Historical Trends
                                "🔮": "⊕"  // AI Predictions
                              }[action.icon] || action.icon;

                              return (
                                <QuickActionButton
                                  key={index}
                                  onClick={() => handleQuickAction(action)}
                                >
                                  <div className="icon">{icon}</div>
                                  <div className="text">{action.text}</div>
                                  {action.description && (
                                    <div className="description">{action.description}</div>
                                  )}
                                </QuickActionButton>
                              );
                            })}
                          </QuickActionsContainer>
                        )}

                        {/* Show pre-graph text */}
                        {msg.content?.preGraphText && (
                          <div style={{ marginBottom: '20px' }}>
                            {msg.content.preGraphText}
                          </div>
                        )}
                        
                        {/* Show graphs based on action type */}
                        {msg.content?.action === 'showMultipleLocations' && (
                          <>
                            <ComparisonGraph />
                            {msg.content?.postGraphText && (
                              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                {msg.content.postGraphText}
                              </div>
                            )}
                            {msg.content?.locations && (
                              <div style={{ marginTop: '20px' }}>
                                {msg.content.locations.map((location, index) => (
                                  <FollowUpButton 
                                    key={index}
                                    onClick={() => handleQuestion("SHOW_BRICKELL_DINING")}
                                  >
                                    Explore {location.name}'s power grid density
                                  </FollowUpButton>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Show Brickell-specific content */}
                        {msg.content?.action === 'navigate' && (
                          <>
                            <BrickellGraph />
                            {msg.content?.postGraphText && (
                              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                {msg.content.postGraphText}
                              </div>
                            )}
                            {msg.content.poiInfo && (
                              <div style={{ 
                                margin: '20px 0',
                                padding: '12px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '8px'
                              }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <span style={{ color: '#FF4500' }}>Points of Interest:</span> {msg.content.poiInfo.poiCount}
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                  <span style={{ color: '#FF4500' }}>Types:</span> {msg.content.poiInfo.poiTypes.join(', ')}
                                </div>
                                
                                {/* Add the new follow-up buttons */}
                                {msg.content.poiInfo.typeFollowUps && (
                                  <div style={{ marginTop: '16px' }}>
                                    {msg.content.poiInfo.typeFollowUps.map((followUp, index) => (
                                      <FollowUpButton 
                                        key={index}
                                        onClick={() => handleQuestion(followUp.prompt)}
                                      >
                                        {followUp.text}
                                      </FollowUpButton>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {msg.content.followUpSuggestions && (
                              <div style={{ marginTop: '20px' }}>
                                {msg.content.followUpSuggestions.map((followUp, index) => (
                                  <FollowUpButton 
                                    key={index}
                                    onClick={() => handleQuestion(followUp.prompt)}
                                  >
                                    {followUp.text}
                                  </FollowUpButton>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {msg.content?.action === 'showGraphs' && (
                            <div style={{ marginTop: '20px' }}>
                                {msg.content.graphs.map((graph, index) => (
                                    <div key={index} style={{ 
                                        marginBottom: '20px',
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '8px',
                                        padding: '15px',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ 
                                            marginBottom: '15px',
                                            color: '#fff'
                                        }}>
                                            <div style={{ 
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                marginBottom: '8px'
                                            }}>
                                                {index === 0 ? 'Power Grid Capacity (MW)' : 'Smart Grid Integration (%)'}
                                            </div>
                                            <div style={{ 
                                                fontSize: '11px',
                                                color: 'rgba(255, 255, 255, 0.6)',
                                                marginBottom: '5px'
                                            }}>
                                                {index === 0 
                                                    ? 'Projected power capacity needs based on growth patterns'
                                                    : 'Smart grid adoption rate across infrastructure'
                                                }
                                            </div>
                                        </div>

                                        <ResponsiveContainer width="100%" height={200}>
                                            <LineChart 
                                                data={graph.data}
                                                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                <XAxis 
                                                    dataKey="year" 
                                                    stroke="#999" 
                                                    tick={{ fill: '#999', fontSize: 11 }}
                                                    tickSize={8}
                                                />
                                                <YAxis 
                                                    stroke="#999"
                                                    tick={{ fill: '#999', fontSize: 11 }}
                                                    width={35}
                                                    tickSize={8}
                                                />
                                                <Tooltip 
                                                    contentStyle={{
                                                        background: 'rgba(0, 0, 0, 0.8)',
                                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                                        borderRadius: '4px',
                                                        color: '#fff',
                                                        fontSize: '11px'
                                                    }}
                                                />
                                                <Legend 
                                                    verticalAlign="top"
                                                    height={36}
                                                    content={({ payload }) => (
                                                        <div style={{ 
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            gap: '20px',
                                                            fontSize: '11px',
                                                            color: '#999'
                                                        }}>
                                                            {payload.map((entry, i) => (
                                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span style={{ 
                                                                        width: '12px',
                                                                        height: '2px',
                                                                        background: entry.color,
                                                                        display: 'inline-block',
                                                                        ...(entry.strokeDasharray && { borderTop: `2px ${entry.color} dashed` })
                                                                    }}/>
                                                                    <span>{entry.value === 'capacity' ? 'Current Trend' : 
                                                                           entry.value === 'smart' ? 'Optimized' : 'Baseline'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="capacity" 
                                                    name="Current Trend"
                                                    stroke="#FF4500"
                                                    strokeWidth={1.5}
                                                    dot={{ fill: '#FF4500', r: 3 }}
                                                    activeDot={{ r: 4 }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="smart" 
                                                    name="Optimized"
                                                    stroke="#FF6E40" 
                                                    strokeDasharray="5 5"
                                                    strokeWidth={1.5}
                                                    dot={{ fill: '#FF6E40', r: 3 }}
                                                    activeDot={{ r: 4 }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="baseline" 
                                                    name="Baseline"
                                                    stroke="#FFAB91" 
                                                    strokeDasharray="3 3"
                                                    strokeWidth={1.5}
                                                    dot={{ fill: '#FFAB91', r: 3 }}
                                                    activeDot={{ r: 4 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>

                                        <div style={{ 
                                            marginTop: '10px',
                                            fontSize: '11px',
                                            color: 'rgba(255, 255, 255, 0.6)'
                                        }}>
                                            {index === 0 
                                                ? 'Projected capacity needs show increasing demand, with optimized scenarios suggesting higher requirements for future growth.'
                                                : 'Smart grid adoption is expected to accelerate, particularly in optimized deployment scenarios.'
                                            }
                                        </div>
                                    </div>
                                ))}
                                
                                <div style={{ marginTop: '20px' }}>
                                    <FollowUpButton 
                                        onClick={async () => {
                                            const text = "Explore Brickell's power grid density";
                                            setMessages(prevMessages => [...prevMessages, {
                                                isUser: true,
                                                content: text
                                            }]);
                                            
                                            const response = await handleQuestion("SHOW_GRID_DENSITY");
                                            setMessages(prevMessages => [...prevMessages, {
                                                isUser: false,
                                                content: {
                                                    ...response,
                                                    followUpSuggestions: [
                                                        {
                                                            text: "How does the Smart Grid optimize power distribution?",
                                                            prompt: "SHOW_SMART_OPTIMIZATION"
                                                        },
                                                        {
                                                            text: "Show Smart Grid sensor network coverage",
                                                            prompt: "SHOW_SENSOR_COVERAGE"
                                                        },
                                                        {
                                                            text: "What AI systems manage the Smart Grid?",
                                                            prompt: "SHOW_SMART_GRID_AI"
                                                        }
                                                    ]
                                                }
                                            }]);
                                        }}
                                    >
                                        Explore Brickell's power grid density
                                    </FollowUpButton>
                                    
                                    <FollowUpButton 
                                        onClick={async () => {
                                            const text = "What impact would smart grid adoption have on costs?";
                                            setMessages(prevMessages => [...prevMessages, {
                                                isUser: true,
                                                content: text
                                            }]);
                                            const response = await handleQuestion("SHOW_SMART_GRID_IMPACT");
                                            setMessages(prevMessages => [...prevMessages, {
                                                isUser: false,
                                                content: response
                                            }]);
                                        }}
                                    >
                                        What impact would smart grid adoption have on costs?
                                    </FollowUpButton>
                                    
                                    <FollowUpButton 
                                        onClick={async () => {
                                            const text = "Show sustainability forecast for next 5 years";
                                            setMessages(prevMessages => [...prevMessages, {
                                                isUser: true,
                                                content: text
                                            }]);
                                            const response = await handleQuestion("SHOW_SUSTAINABILITY_FORECAST");
                                            setMessages(prevMessages => [...prevMessages, {
                                                isUser: false,
                                                content: response
                                            }]);
                                        }}
                                    >
                                        Show sustainability forecast for next 5 years
                                    </FollowUpButton>
                                </div>
                            </div>
                        )}

                        {msg.content?.zoomOutButton && (
                          <div style={{ marginTop: '20px' }}>
                            <button
                              onClick={() => {
                                if (map.current) {
                                  // Create a draggable popup
                                  const popup = new mapboxgl.Popup({
                                    closeButton: true,
                                    closeOnClick: false,
                                    className: 'custom-popup custom-draggable-popup',
                                    maxWidth: '300px',
                                    draggable: true
                                  })
                                    .setLngLat([-80.1918, 25.7650])
                                    .setHTML(`
                                      <div style="
                                        background: rgba(0, 0, 0, 0.85);
                                        color: white;
                                        padding: 20px;
                                        border-radius: 8px;
                                        font-family: 'SF Mono', monospace;
                                        cursor: move;
                                      ">
                                        <div style="
                                          margin: 0 0 12px 0;
                                          color: #FF4500;
                                          font-size: 16px;
                                          display: flex;
                                          align-items: center;
                                          justify-content: space-between;
                                        ">
                                          <span>Power Grid Overview</span>
                                          <span style="
                                            font-size: 12px;
                                            color: rgba(255,255,255,0.5);
                                          ">⟺ Drag to move</span>
                                        </div>
                                        <div style="
                                          font-size: 14px;
                                          line-height: 1.4;
                                        ">
                                          <p>• 45+ power nodes per square mile</p>
                                          <p>• 85% smart grid coverage</p>
                                          <p>• N+2 redundancy systems</p>
                                          <p>• 35% growth capacity</p>
                                        </div>
                                        <button id="zoomOutBtn" style="
                                          width: 100%;
                                          margin-top: 16px;
                                          padding: 8px;
                                          background: rgba(255, 69, 0, 0.2);
                                          border: 1px solid rgba(255, 69, 0, 0.3);
                                          border-radius: 4px;
                                          color: #FF4500;
                                          cursor: pointer;
                                          font-family: 'SF Mono', monospace;
                                          font-size: 12px;
                                          transition: all 0.2s;
                                        ">View District Overview</button>
                                      </div>
                                    `)
                                    .addTo(map.current);

                                  // Add click handler for the zoom out button
                                  const zoomOutBtn = document.getElementById('zoomOutBtn');
                                  if (zoomOutBtn) {
                                    zoomOutBtn.addEventListener('click', (e) => {
                                      e.stopPropagation();
                                      
                                      // Close the popup
                                      popup.remove();
                                      
                                      // Zoom out much further
                                      map.current.flyTo({
                                        zoom: map.current.getZoom() - 5, // Increased zoom out amount
                                        duration: 1500
                                      });

                                      // Create the circle and callout for Brickell
                                      const brickellFeature = {
                                        type: 'Feature',
                                        geometry: {
                                          type: 'Point',
                                          coordinates: [-80.1918, 25.7650]
                                        },
                                        properties: {
                                          name: 'Brickell',
                                          description: "Miami's financial district"
                                        }
                                      };

                                      // Add/update the circle
                                      const source = map.current.getSource('area-highlights');
                                      if (source) {
                                        source.setData({
                                          type: 'FeatureCollection',
                                          features: [brickellFeature]
                                        });
                                      }

                                      // Add larger location marker in center
                                      const markerElement = document.createElement('div');
                                      markerElement.innerHTML = `
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="#FF4500" style="filter: drop-shadow(0px 0px 6px rgba(0,0,0,0.3));">
                                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                        </svg>
                                      `;

                                      new mapboxgl.Marker({
                                        element: markerElement,
                                        anchor: 'center'
                                      })
                                        .setLngLat([-80.1918, 25.7650])
                                        .addTo(map.current);

                                      // Ensure the circle outline layer exists
                                      if (!map.current.getLayer('area-highlights-outline')) {
                                        map.current.addLayer({
                                          'id': 'area-highlights-outline',
                                          'type': 'circle',
                                          'source': 'area-highlights',
                                          'paint': {
                                            'circle-radius': 100,
                                            'circle-color': 'transparent',
                                            'circle-stroke-width': 2,
                                            'circle-stroke-color': '#FF4500',
                                            'circle-opacity': 0.8
                                          }
                                        });
                                      }

                                      // Add the callout
                                      const calloutHTML = document.createElement('div');
                                      calloutHTML.className = 'callout-annotation';
                                      calloutHTML.innerHTML = `
                                        <div style="
                                          background: rgba(0, 0, 0, 0.85);
                                          color: white;
                                          padding: 15px;
                                          border-radius: 8px;
                                          max-width: 300px;
                                          position: relative;
                                          font-family: 'SF Mono', monospace;
                                          font-size: 14px;
                                          line-height: 1.4;
                                        ">
                                          <div style="
                                            display: flex;
                                            align-items: center;
                                            justify-content: space-between;
                                            margin-bottom: 8px;
                                          ">
                                            <h3 style="
                                              margin: 0;
                                              color: white;
                                              font-size: 16px;
                                              font-weight: 500;
                                            ">Brickell</h3>
                                            <span style="display: flex; gap: 12px; color: #FF4500;">
                                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>
                                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"/></svg>
                                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                                            </span>
                                          </div>
                                          <div style="
                                            font-size: 13px;
                                            color: rgba(255, 255, 255, 0.8);
                                            margin-top: 12px;
                                            padding-left: 8px;
                                            border-left: 2px solid rgba(255, 69, 0, 0.5);
                                          ">
                                            • 45+ power nodes/sq mile<br>
                                            • 8 power substations<br>
                                            • 85% smart grid coverage<br>
                                            • N+2 redundancy systems<br>
                                            • 35% growth capacity<br>
                                            • 12 high-capacity transformers
                                          </div>
                                        </div>
                                      `;

                                      new mapboxgl.Marker({
                                        element: calloutHTML,
                                        anchor: 'left',
                                      })
                                        .setLngLat([-80.1918, 25.7650])
                                        .setOffset([100, 100])
                                        .addTo(map.current);
                                    });

                                    // Add hover effects
                                    zoomOutBtn.addEventListener('mouseover', () => {
                                      zoomOutBtn.style.background = 'rgba(255, 69, 0, 0.3)';
                                    });
                                    zoomOutBtn.addEventListener('mouseout', () => {
                                      zoomOutBtn.style.background = 'rgba(255, 69, 0, 0.2)';
                                    });
                                  }

                                  // Add drag functionality
                                  const popupEl = popup.getElement();
                                  let isDragging = false;
                                  let startX, startY, startLeft, startTop;

                                  popupEl.addEventListener('mousedown', (e) => {
                                    if (e.target.closest('.mapboxgl-popup-content')) {
                                      isDragging = true;
                                      startX = e.clientX;
                                      startY = e.clientY;
                                      const rect = popupEl.getBoundingClientRect();
                                      startLeft = rect.left;
                                      startTop = rect.top;
                                      
                                      popupEl.style.cursor = 'grabbing';
                                    }
                                  });

                                  document.addEventListener('mousemove', (e) => {
                                    if (!isDragging) return;
                                    
                                    const dx = e.clientX - startX;
                                    const dy = e.clientY - startY;
                                    
                                    const point = map.current.unproject([
                                      startLeft + dx,
                                      startTop + dy
                                    ]);
                                    
                                    popup.setLngLat(point);
                                  });

                                  document.addEventListener('mouseup', () => {
                                    isDragging = false;
                                    if (popupEl) {
                                      popupEl.style.cursor = 'move';
                                    }
                                  });

                                  // Clean up event listeners when popup is closed
                                  popup.on('close', () => {
                                    document.removeEventListener('mousemove', null);
                                    document.removeEventListener('mouseup', null);
                                  });
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#FF4500',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseOver={(e) => e.target.style.backgroundColor = '#FF5722'}
                              onMouseOut={(e) => e.target.style.backgroundColor = '#FF4500'}
                            >
                              {msg.content.zoomOutButton.text}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </MessageContent>
                </Message>
              );
            })}
            
            {isLoading && (
              <Message>
                <MessageHeader>
                  <Avatar />
                  <Sender>ATLAS</Sender>
                </MessageHeader>
                <MessageContent>
                  <LoadingMessage>
                    <LoadingStep $delay={300}>
                      <span className="icon">🗺️</span>
                      <span className="text">Analyzing energy consumption patterns...</span>
                      <span className="dots" />
                    </LoadingStep>
                    <LoadingStep $delay={600}>
                      <span className="icon">📡</span>
                      <span className="text">Scanning 5G infrastructure coverage...</span>
                      <span className="dots" />
                    </LoadingStep>
                    <LoadingStep $delay={900}>
                      <span className="icon">⚡</span>
                      <span className="text">Processing smart grid distribution...</span>
                      <span className="dots" />
                    </LoadingStep>
                    <LoadingStep $delay={1200}>
                      <span className="icon">🏢</span>
                      <span className="text">Mapping commercial density zones...</span>
                      <span className="dots" />
                    </LoadingStep>
                    <LoadingStep $delay={1500}>
                      <span className="icon">📊</span>
                      <span className="text">Correlating FPL power usage data...</span>
                      <span className="dots" />
                    </LoadingStep>
                  </LoadingMessage>
                </MessageContent>
              </Message>
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </ChatMessages>
      
      <InputArea>
        <Input 
          placeholder="Message AI Map..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleSubmit}
        />
      </InputArea>

      {/* Popup for "Hello" message */}
      {showPopup && (
        <Popup>
          Hello
          <CloseButton onClick={() => setShowPopup(false)}>Close</CloseButton>
        </Popup>
      )}
    </Panel>
  );
};

// Styled components
const Popup = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 8px;
  z-index: 1000;
`;

const CloseButton = styled.button`
  margin-top: 10px;
  background: #FF4500;
  border: none;
  padding: 8px 16px;
  color: white;
  border-radius: 4px;
  cursor: pointer;
`;

export default AIChatPanel; 