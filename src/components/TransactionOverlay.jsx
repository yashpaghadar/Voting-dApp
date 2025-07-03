import React, { useEffect } from 'react';
import './TransactionOverlay.css';

const TransactionOverlay = ({ isVisible, status, message, onClose }) => {
  const getStatusClass = () => {
    switch (status) {
      case 'loading':
        return 'loading';
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return '';
    }
  };

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(() => {
        onClose();
      }, 1000); // Auto-close after 1 seconds
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  return (
    <div className={`transaction-overlay ${isVisible ? 'visible' : 'hidden'}`}>
      <div className={`transaction-overlay-content ${getStatusClass()}`}>
        {status === 'loading' && (
          <>
            <div className="loading-spinner"></div>
            <p>Please wait...</p>
            <p>Transaction in process. This may take a few seconds...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <button className="close-button" onClick={onClose}>×</button>
            <div className="success-icon">✓</div>
            <p>Transaction Successful!</p>
            <p>{message}</p>
            <p className="auto-close">This message will auto-close in 1 seconds</p>
          </>
        )}
        {status === 'error' && (
          <>
            <button className="close-button" onClick={onClose}>×</button>
            <div className="error-icon">✗</div>
            <p>Transaction Failed</p>
            <p>{message}</p>
            <p className="auto-close">This message will auto-close in 1 seconds</p>
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionOverlay;
