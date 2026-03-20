import { API_URL } from '../config.js';

function buildDocumentFileUrl(workOrderId, documentId) {
  const base = (API_URL || '/api').replace(/\/$/, '');
  const path = `/work-orders/${workOrderId}/documents/${encodeURIComponent(String(documentId))}/file`;
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return `${base}${path}`;
  }
  return `${base}${path}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showHtmlInWindow(win, title, bodyHtml) {
  win.document.open();
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${bodyHtml}</body></html>`
  );
  win.document.close();
}

/**
 * Abre el PDF en una pestaña nueva.
 * - Ventana al instante (mismo clic del usuario).
 * - Sin noopener: con noopener algunos navegadores no permiten asignar blob: a esa ventana.
 * - fetch (no axios): evita redirigir toda la app en 401 y muestra el error en la pestaña nueva.
 * Si el fallo ya se mostró en la pestaña, no se lanza excepción → el modal de la app no aparece.
 */
export async function openWorkOrderDocumentInNewTab(workOrderId, document) {
  if (document?.id === undefined || document?.id === null) {
    throw new Error('Documento inválido');
  }

  const win = window.open('about:blank', '_blank');
  if (!win) {
    throw new Error('Permita ventanas emergentes para ver el documento');
  }

  const token = localStorage.getItem('token');
  const reqUrl = buildDocumentFileUrl(workOrderId, document.id);

  try {
    showHtmlInWindow(
      win,
      'Cargando…',
      '<p style="font-family:system-ui;padding:2rem;color:#444;">Cargando documento…</p>'
    );
  } catch {
    /* noop */
  }

  let res;
  try {
    res = await fetch(reqUrl, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (netErr) {
    try {
      showHtmlInWindow(
        win,
        'Error',
        `<p style="font-family:system-ui;padding:2rem;color:#b91c1c;">${escapeHtml(
          netErr?.message || 'Error de red al descargar el documento'
        )}</p>`
      );
    } catch {
      try {
        win.close();
      } catch (_) {
        /* noop */
      }
    }
    return;
  }

  if (!res.ok) {
    let msg = 'No se pudo abrir el documento';
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        msg = j.error || msg;
      } else {
        const t = await res.text();
        if (t) {
          try {
            const j = JSON.parse(t);
            msg = j.error || t.slice(0, 300);
          } catch {
            msg = t.slice(0, 300);
          }
        }
      }
    } catch {
      /* keep msg */
    }
    if (res.status === 401) {
      msg = 'Sesión expirada o no válida. Inicie sesión de nuevo.';
    }
    try {
      showHtmlInWindow(
        win,
        'Error',
        `<p style="font-family:system-ui;padding:2rem;color:#b91c1c;">${escapeHtml(msg)}</p>`
      );
    } catch {
      try {
        win.close();
      } catch (_) {
        /* noop */
      }
    }
    return;
  }

  const mime = res.headers.get('content-type') || document.mime_type || 'application/pdf';
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    try {
      showHtmlInWindow(
        win,
        'Error',
        '<p style="font-family:system-ui;padding:2rem;">El archivo está vacío o no es válido.</p>'
      );
    } catch {
      try {
        win.close();
      } catch (_) {
        /* noop */
      }
    }
    return;
  }

  const typedBlob = blob.type ? blob : new Blob([blob], { type: mime });
  const objUrl = URL.createObjectURL(typedBlob);

  try {
    win.location.replace(objUrl);
  } catch {
    try {
      const safeSrc = objUrl.replace(/"/g, '');
      showHtmlInWindow(
        win,
        document.file_name || 'Documento',
        `<div style="margin:0;height:100vh;width:100%;">
          <embed type="${escapeHtml(mime)}" src="${safeSrc}" width="100%" height="100%" style="min-height:100vh;display:block;" />
        </div>`
      );
    } catch (e2) {
      URL.revokeObjectURL(objUrl);
      try {
        win.close();
      } catch (_) {
        /* noop */
      }
      throw new Error(e2?.message || 'No se pudo mostrar el PDF en la ventana nueva');
    }
  }

  setTimeout(() => URL.revokeObjectURL(objUrl), 300000);
}
