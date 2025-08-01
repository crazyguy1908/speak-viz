import React from 'react';
import './WaitingAnimation.css';

const WaitingAnimation = ({ isVisible, message = "Analyzing your recording..." }) => {
  if (!isVisible) return null;

  return (
    <div className="waiting-overlay">
      <div className="waiting-content">
        <div className="spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <div className="waiting-text">
          <h3>Processing...</h3>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
};

export default WaitingAnimation; 