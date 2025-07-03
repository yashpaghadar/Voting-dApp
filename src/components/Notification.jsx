import React, { useEffect } from 'react';
import { FaTimes, FaCheck, FaExclamationTriangle, FaInfoCircle, FaExclamationCircle } from 'react-icons/fa';
import './Notification.css';

const Notification = ({ show, title, message, type = 'info', onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const iconMap = {
    success: <FaCheck className="notification-icon notification-icon-success" />,
    error: <FaExclamationCircle className="notification-icon notification-icon-error" />,
    warning: <FaExclamationTriangle className="notification-icon notification-icon-warning" />,
    info: <FaInfoCircle className="notification-icon notification-icon-info" />,
  };

  // Ensure type is one of the expected values
  const notificationType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
  
  return (
    <div className={`notification notification-${notificationType}`}>
      <div className="notification-content">
        <div className="notification-icon-container">
          {iconMap[notificationType]}
        </div>
        <div className="notification-text">
          {title && <span className="notification-title">{title}: </span>}
          {message && <span className="notification-message">{message}</span>}
        </div>
      </div>
    </div>
  );
};

export default Notification;
