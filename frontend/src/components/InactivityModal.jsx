import { createPortal } from 'react-dom';
import './InactivityModal.css';

export default function InactivityModal({ open, message, onClose }) {
  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const content = (
    <div className="inactivity-modal-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="inactivity-modal-title">
      <div className="inactivity-modal">
        <div className="inactivity-modal-accent" />
        <div className="inactivity-modal-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h2 id="inactivity-modal-title" className="inactivity-modal-title">Sesión expirada</h2>
        <p className="inactivity-modal-message">{message}</p>
        <button type="button" className="inactivity-modal-btn" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
