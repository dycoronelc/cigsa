import api from '../services/api';

/**
 * Abre un documento de la OT en una pestaña nueva usando el token JWT (axios).
 *
 * Importante: hay que abrir la ventana en el mismo "tick" del clic del usuario
 * (antes de cualquier await). Si se hace await y luego window.open(), el bloqueador
 * devuelve null y además puede mostrarse el error aunque el PDF llegue a abrirse.
 */
export async function openWorkOrderDocumentInNewTab(workOrderId, document) {
  if (document?.id === undefined || document?.id === null) {
    throw new Error('Documento inválido');
  }

  const win = window.open('about:blank', '_blank', 'noopener,noreferrer');
  if (!win) {
    throw new Error('Permita ventanas emergentes para ver el documento');
  }

  try {
    try {
      win.document.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cargando…</title></head><body style="font-family:system-ui;padding:2rem;color:#444;">Cargando documento…</body></html>'
      );
      win.document.close();
    } catch {
      /* noop: políticas del navegador pueden impedir escribir en la ventana */
    }

    const path = `/work-orders/${workOrderId}/documents/${encodeURIComponent(String(document.id))}/file`;
    const res = await api.get(path, { responseType: 'blob' });
    const mime = res.headers['content-type'] || document.mime_type || 'application/pdf';
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: mime });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 180000);
  } catch (e) {
    try {
      win.close();
    } catch (_) {
      /* noop */
    }

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
