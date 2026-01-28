import { useEffect } from 'react';
import './AlertDialog.css';

export default function AlertDialog({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info', // 'info', 'success', 'warning', 'error', 'confirm'
  onConfirm,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancel = false,
  confirmDanger = false
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && type !== 'confirm') {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✕';
      case 'confirm':
        return '?';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="alert-dialog-overlay" onClick={handleBackdropClick}>
      <div className={`alert-dialog alert-dialog-${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="alert-dialog-icon">{getIcon()}</div>
        {title && <h3 className="alert-dialog-title">{title}</h3>}
        <p className="alert-dialog-message">{message}</p>
        <div className="alert-dialog-actions">
          {showCancel && (
            <button 
              type="button" 
              className="alert-dialog-btn alert-dialog-btn-cancel"
              onClick={handleCancel}
            >
              {cancelText}
            </button>
          )}
          <button 
            type="button" 
            className={`alert-dialog-btn alert-dialog-btn-${confirmDanger && type === 'confirm' ? 'error' : type}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
