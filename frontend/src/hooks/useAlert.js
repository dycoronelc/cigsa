import { useState, useCallback } from 'react';

export function useAlert() {
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    showCancel: false
  });

  const showAlert = useCallback(({ type = 'info', title = '', message = '', onConfirm = null, showCancel = false }) => {
    setAlertDialog({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      showCancel
    });
  }, []);

  const showError = useCallback((message, title = 'Error') => {
    showAlert({ type: 'error', title, message });
  }, [showAlert]);

  const showSuccess = useCallback((message, title = 'Éxito') => {
    showAlert({ type: 'success', title, message });
  }, [showAlert]);

  const showWarning = useCallback((message, title = 'Advertencia') => {
    showAlert({ type: 'warning', title, message });
  }, [showAlert]);

  const showConfirm = useCallback((message, onConfirm, title = 'Confirmar') => {
    showAlert({ type: 'confirm', title, message, onConfirm, showCancel: true });
  }, [showAlert]);

  const closeAlert = useCallback(() => {
    setAlertDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    alertDialog,
    showAlert,
    showError,
    showSuccess,
    showWarning,
    showConfirm,
    closeAlert
  };
}
