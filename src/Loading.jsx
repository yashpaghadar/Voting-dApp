import React from 'react';
import './Loading.css';

const Loading = ({ text = 'Loading...' }) => (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">{text}</div>
    </div>
  </div>
);

export default Loading;
