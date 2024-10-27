import React, { useRef, useState, useEffect } from 'react';
import PhysicalView from './Views/Building/PhysicalView';
import FinanceView from './Views/Finance/FinanceView';
import ZoningView from './Views/Zoning/ZoningView';
import ValidationPanel from '../ValidationPanel';

function BuildingPopup({
  selectedArticle, popupCoordinates, handleBackToOriginal, handleValidate,
  handleMatchResults, showComparison, validationError, isValidating, retryCount,
  MAX_RETRIES, lastValidationTime, showTypewriter, matchedResults, validatedData,
  validationScore, handleAnalysis
}) {
  const popupRef = useRef(null);
  const [popupWidth, setPopupWidth] = useState(534); // Increased by 20% from 445
  const [popupHeight, setPopupHeight] = useState('85vh');
  const [activeView, setActiveView] = useState(null);

  const handlePopupResize = (widthChange, heightChange) => {
    setPopupWidth(prevWidth => Math.max(300, Math.min(800, prevWidth + widthChange)));
    setPopupHeight(prevHeight => {
      const currentHeight = parseInt(prevHeight);
      const newHeight = Math.max(30, Math.min(95, currentHeight + heightChange));
      return `${newHeight}vh`;
    });
  };

  const handleViewChange = (view) => {
    setActiveView(activeView === view ? null : view);
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
        width: `${popupWidth}px`,
        maxHeight: '95vh',
        overflowY: 'auto',
        maxWidth: '108vw', // Increased by 20% from 90vw
      }}
    >
      <h2 style={{ 
        color: '#FFFFFF', 
        marginTop: '0', 
        marginBottom: '10px',
        fontWeight: 'bold',
        fontSize: '1.2em'
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
        <img
          src={selectedArticle.image_url}
          alt={selectedArticle.title}
          style={{ maxWidth: '100%', height: 'auto', marginBottom: '20px'}}
        />
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', width: '100%' }}>
        <button
          onClick={() => handleViewChange('physical')}
          style={{
            backgroundColor: activeView === 'physical' ? '#FF0000' : '#333',
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            flex: 1,
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = activeView === 'physical' ? '#FF0000' : '#444'}
          onMouseOut={(e) => e.target.style.backgroundColor = activeView === 'physical' ? '#FF0000' : '#333'}
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
            flex: 1,
            transition: 'background-color 0.3s'
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
            flex: 1,
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = activeView === 'zoning' ? '#FF0000' : '#444'}
          onMouseOut={(e) => e.target.style.backgroundColor = activeView === 'zoning' ? '#FF0000' : '#333'}
        >
          ZONING
        </button>
      </div>
      <div>
        {activeView === 'physical' && <PhysicalView />}
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
  );
}

export default BuildingPopup;
