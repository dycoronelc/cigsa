import api from '../services/api';

/**
 * Abre un documento de la OT en una pestaña nueva usando el token JWT (axios).
 * Evita depender de navegación directa a /api/uploads: la PWA suele devolver index.html → Dashboard.
 */
export async function openWorkOrderDocumentInNewTab(workOrderId, document) {
  if (document?.id === undefined || document?.id === null) {
    throw new Error('Documento inválido');
  }
  const path = `/work-orders/${workOrderId}/documents/${encodeURIComponent(String(document.id))}/file`;
  try {
    const res = await api.get(path, { responseType: 'blob' });
    const mime = res.headers['content-type'] || document.mime_type || 'application/pdf';
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: mime });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      URL.revokeObjectURL(url);
      throw new Error('Permita ventanas emergentes para ver el documento');
    }
    setTimeout(() => URL.revokeObjectURL(url), 180000);
  } catch (e) {
    const data = e?.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const j = JSON.parse(text);
        throw new Error(j.error || 'Error al abrir el documento');
      } catch (inner) {
        if (inner instanceof SyntaxError) {
          throw new Error('Error al abrir el documento');
        }
        throw inner;
      }
    }
    throw new Error(e?.response?.data?.error || e?.message || 'Error al abrir el documento');
  }
}
