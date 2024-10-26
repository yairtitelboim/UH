import React from 'react';

function FinanceView() {
  const handleFinance = () => {
    // Logic for handling finance
  };

  return (
    <button
      onClick={handleFinance}
      style={{
        backgroundColor: '#333',
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
      onMouseOver={(e) => e.target.style.backgroundColor = '#444'}
      onMouseOut={(e) => e.target.style.backgroundColor = '#333'}
    >
      FINANCE
    </button>
  );
}

export default FinanceView;
