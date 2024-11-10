import React, { useRef, useState, useEffect } from 'react';
import PhysicalView from './Views/Building/PhysicalView';
import FinanceView from './Views/Finance/FinanceView';
import ZoningView from './Views/Zoning/ZoningView';
import ValidationPanel from '../ValidationPanel';
import MasterMetrics from './Views/Comps/Dashboard';
import { Book, Scale } from 'lucide-react';
import ScalePopup from './Views/Comps/Scale';

const BUILDING_COLORS = {
  OUTER: '#FF4136',  // Red color matching map layer
  INNER: '#4CAF50',  // Green color matching map layer
  BUTTON_ACTIVE: '#FF0000',
  BUTTON_INACTIVE: '#333',
};

function BuildingPopup({
  selectedArticle, popupCoordinates, handleBackToOriginal, handleValidate,
  handleMatchResults, showComparison, validationError, isValidating, retryCount,
  MAX_RETRIES, lastValidationTime, showTypewriter, matchedResults, validatedData,
  validationScore, handleAnalysis
}) {
  const popupRef = useRef(null);
  const [popupWidth] = useState(490); // Remove setPopupWidth as we want fixed width
  const [popupHeight, setPopupHeight] = useState('85vh');
  const [activeView, setActiveView] = useState('dashboard');
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [buildingOffset] = useState(30);

  useEffect(() => {
    console.log('BuildingPopup rendered');
  }, []);

  const handleViewChange = (view) => {
    console.log(`Changing view to: ${view}`);
    setActiveView(activeView === view ? 'dashboard' : view);
  };

  const toggleScalePopup = () => {
    setShowScalePopup(!showScalePopup);
  };

  const exampleBuildingData = {
    address: "1234 Example St",
    neighborhood: "Example Neighborhood",
    city: "Example City",
    state: "EX",
    completion_date: "2025",
    image_url: "https://via.placeholder.com/150",
    title: "Example Building"
  };

  // Create separate container styles for main content and scale popup
  const mainContentStyle = {
    width: `${popupWidth}px`,
    flex: 'none', // Prevent flex from affecting width
  };

  const scalePopupStyle = {
    width: `${popupWidth}px`,
    flex: 'none', // Prevent flex from affecting width
    marginLeft: '10px',
  };

  return (
    <div 
      ref={popupRef}
      style={{
        position: 'absolute',
        left: '10px',
        top: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        padding: '10px',
        borderRadius: '5px',
        maxHeight: '95vh',
        overflowY: 'auto',
        maxWidth: '118vw',
        display: 'flex',
        width: 'auto', // Let width be determined by content
      }}
    >
      <div style={mainContentStyle}>
        <h2 style={{ 
          color: '#FFFFFF', 
          marginTop: '0', 
          marginBottom: '10px',
          fontWeight: 'bold',
          fontSize: '1.2em',
          maxWidth: '400px',
          lineHeight: '1.4em',
        }}>
          {selectedArticle.location.address || 'N/A'}, {selectedArticle.location.neighborhood || ''} {selectedArticle.location.city || 'Unknown City'}, {selectedArticle.location.state || 'Unknown State'}
        </h2>
        <p style={{ 
          color: '#AAAAAA', 
          fontSize: '0.9em', 
          marginTop: '0', 
          marginBottom: '20px' 
        }}>
          Completion Date: {selectedArticle.completion_date || 'Unknown'}
        </p>
        {selectedArticle.image_url && (
          <div style={{ position: 'relative' }}>
            <img
              src={selectedArticle.image_url}
              alt={selectedArticle.title}
              style={{ maxWidth: '100%', height: 'auto', marginBottom: '30px' }}
            />
            <button
              onClick={() => handleViewChange('dashboard')}
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                backgroundColor: '#333',
                border: 'none',
                padding: '5px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px'
              }}
            >
              <Book style={{ color: '#fff', width: '20px', height: '20px' }} />
            </button>
            <button
              onClick={toggleScalePopup}
              style={{
                position: 'absolute',
                top: '10px',
                left: '50px',
                backgroundColor: '#242020',
                border: 'none',
                padding: '5px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px'
              }}
            >
              <Scale style={{ color: '#fff', width: '20px', height: '20px' }} />
            </button>
          </div>
        )}
        <div 
          style={{ 
            display: 'flex', 
            gap: '10px', 
            width: '90%', 
            marginLeft: '5%',
            height: '40px',
            transition: 'width 0.3s',
            justifyContent: activeView ? 'center' : 'space-between',
            margin: '0 auto'
          }}
        >
          <button
            onClick={() => {
              handleViewChange('physical');
              handleAnalysis();
            }}
            style={{
              backgroundColor: activeView === 'physical' ? BUILDING_COLORS.OUTER : BUILDING_COLORS.BUTTON_INACTIVE,
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              flex: activeView === 'physical' ? 1.2 : 1,
              transition: 'background-color 0.3s, flex 0.3s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = activeView === 'physical' ? BUILDING_COLORS.OUTER : '#444'}
            onMouseOut={(e) => e.target.style.backgroundColor = activeView === 'physical' ? BUILDING_COLORS.OUTER : BUILDING_COLORS.BUTTON_INACTIVE}
          >
            PLAN
          </button>
          <button
            onClick={() => handleViewChange('finance')}
            style={{
              backgroundColor: activeView === 'finance' ? '#FF0000' : '#333',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              flex: activeView === 'finance' ? 1.2 : 1,
              transition: 'background-color 0.3s, flex 0.3s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = activeView === 'finance' ? '#FF0000' : '#444'}
            onMouseOut={(e) => e.target.style.backgroundColor = activeView === 'finance' ? '#FF0000' : '#333'}
          >
            FINANCE
          </button>
          <button
            onClick={() => handleViewChange('zoning')}
            style={{
              backgroundColor: activeView === 'zoning' ? '#FF0000' : '#333',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              flex: activeView === 'zoning' ? 1.2 : 1,
              transition: 'background-color 0.3s, flex 0.3s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = activeView === 'zoning' ? '#FF0000' : '#444'}
            onMouseOut={(e) => e.target.style.backgroundColor = activeView === 'zoning' ? '#FF0000' : '#333'}
          >
            ZONING
          </button>
        </div>
        <div>
          {activeView === 'dashboard' && <MasterMetrics />}
          {activeView === 'physical' && (
            <PhysicalView 
              buildingOffset={buildingOffset}
              colors={BUILDING_COLORS}
            />
          )}
          {activeView === 'finance' && <FinanceView />}
          {activeView === 'zoning' && <ZoningView />}
        </div>
        <ValidationPanel
          handleValidate={handleValidate}
          handleMatchResults={handleMatchResults}
          showComparison={showComparison}
          validationError={validationError}
          isValidating={isValidating}
          retryCount={retryCount}
          MAX_RETRIES={MAX_RETRIES}
          lastValidationTime={lastValidationTime}
          showTypewriter={showTypewriter}
          matchedResults={matchedResults}
          validatedData={validatedData}
          validationScore={validationScore}
        />
      </div>
      {showScalePopup && (
        <div style={scalePopupStyle}>
          <ScalePopup buildingData={exampleBuildingData} />
        </div>
      )}
    </div>
  );
}

export default BuildingPopup;