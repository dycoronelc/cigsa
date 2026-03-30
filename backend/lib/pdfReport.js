/**
 * Genera el PDF del reporte de OT con encabezado y pie en todas las páginas.
 * Recibe el objeto completo de la OT (como GET /work-orders/:id).
 */
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 40;
const CONTENT_TOP = MARGIN + HEADER_HEIGHT;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
/** Espacio entre la línea del encabezado y el título del reporte */
const TITLE_MARGIN_BELOW_HEADER = 12;

const RUC = '179308-1-391832 D.V. 47';
const FOOTER_TEXT = 'Tel.: (+507) 996-1391 / 9772  -  e-mail: cigsa@cigonzalez.com  -  www.cigsapanama.com  -  Chitré - Herrera - Panamá';

function getLogoPath() {
  return path.join(__dirname, '..', 'assets', 'logo.png');
}

/** Ruta absoluta del archivo de un documento. Usa file_path (ej. /uploads/documents/nombre.ext) o file_name. */
function getDocumentFilePath(docItem) {
  const fp = (docItem.file_path || '').trim();
  const name = (path.basename(fp) || docItem.file_name || '').trim();
  if (!name) return null;
  return path.join(__dirname, '..', 'uploads', 'documents', name);
}

/** Ruta absoluta de una foto de OT (photo_path ej. /uploads/photos/nombre.ext). */
function getPhotoFilePath(photo) {
  const fp = (photo.photo_path || '').trim();
  const name = path.basename(fp.replace(/^\/+/, ''));
  if (!name) return null;
  return path.join(__dirname, '..', 'uploads', 'photos', name);
}

/** Convierte signature_data (data URL base64) a Buffer para PDFKit, o null. */
function signatureDataToBuffer(signatureData) {
  if (!signatureData || typeof signatureData !== 'string') return null;
  const match = signatureData.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch (_) {
    return null;
  }
}

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp)$/i;
const MAX_PLANO_IMAGE_HEIGHT = 200;
const PLANO_ITEM_HEIGHT = MAX_PLANO_IMAGE_HEIGHT + 18;

/** Misma lógica que en la UI: checkbox = visible para técnico; esos documentos entran al reporte. */
function isDocumentVisibleForReport(d) {
  const v = d.is_visible_to_technician;
  if (v === false || v === 0 || v === '0') return false;
  return true;
}

/** Anexa al final del PDF las páginas de cada plano PDF (PDFKit no incrusta PDFs como imagen). */
async function appendBlueprintPdfPages(mainBuffer, pdfDocItems) {
  if (!pdfDocItems || pdfDocItems.length === 0) return mainBuffer;
  let mainPdf;
  try {
    mainPdf = await PdfLibDocument.load(mainBuffer);
  } catch (e) {
    console.error('appendBlueprintPdfPages: no se pudo cargar el reporte base', e?.message || e);
    return mainBuffer;
  }
  for (const d of pdfDocItems) {
    const absPath = getDocumentFilePath(d);
    if (!absPath || !fs.existsSync(absPath)) continue;
    try {
      const bytes = fs.readFileSync(absPath);
      const src = await PdfLibDocument.load(bytes);
      const pageIndices = src.getPageIndices();
      const copied = await mainPdf.copyPages(src, pageIndices);
      copied.forEach((p) => mainPdf.addPage(p));
    } catch (e) {
      console.error('appendBlueprintPdfPages: omitiendo', d.file_name, e?.message || e);
    }
  }
  try {
    const out = await mainPdf.save();
    return Buffer.from(out);
  } catch (e) {
    console.error('appendBlueprintPdfPages: error al guardar', e?.message || e);
    return mainBuffer;
  }
}

/** Dibuja el encabezado (logo, nombre, RUC, cajas día/mes/año) con borde. */
function drawHeader(doc, reportDate) {
  const y = MARGIN;

  doc.rect(MARGIN, y, CONTENT_WIDTH, HEADER_HEIGHT).stroke();

  const boxY = y + 8;
  let logoDrawn = false;
  try {
    const lp = getLogoPath();
    if (fs.existsSync(lp)) {
      doc.image(lp, MARGIN + 6, boxY, { width: 72, height: 36 });
      logoDrawn = true;
    }
  } catch (_) {
    /* fallback to text */
  }
  if (!logoDrawn) {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a237e').text('CIGSA', MARGIN + 8, boxY);
    doc.fontSize(8).font('Helvetica').fillColor('#333').text('Welding and Machining', MARGIN + 8, boxY + 20);
  }

  doc.fontSize(10).font('Helvetica-Bold').fillColor('black');
  doc.text('CENTRO INDUSTRIAL GONZALEZ – CIGSA', MARGIN + 100, boxY, { width: 220, align: 'center' });
  doc.font('Helvetica').fontSize(9);
  doc.text('Tornería de precisión - Hojalatería', MARGIN + 100, boxY + 12, { width: 220, align: 'center' });
  doc.text('Soldadura Especializada', MARGIN + 100, boxY + 24, { width: 220, align: 'center' });

  doc.font('Helvetica').fontSize(8).fillColor('#333');
  doc.text(`RUC: ${RUC}`, PAGE_WIDTH - MARGIN - 120, boxY, { width: 114, align: 'right' });

  const boxW = 32;
  const boxX = PAGE_WIDTH - MARGIN - 3 * boxW - 8;
  doc.rect(boxX, boxY + 14, boxW, 18).stroke();
  doc.rect(boxX + boxW + 2, boxY + 14, boxW, 18).stroke();
  doc.rect(boxX + 2 * (boxW + 2), boxY + 14, boxW + 4, 18).stroke();
  doc.font('Helvetica').fontSize(10).fillColor('black').text(reportDate.day, boxX, boxY + 18, { width: boxW, align: 'center' });
  doc.text(reportDate.month, boxX + boxW + 2, boxY + 18, { width: boxW, align: 'center' });
  doc.text(reportDate.year, boxX + 2 * (boxW + 2), boxY + 18, { width: boxW + 4, align: 'center' });
}

function formatDate(d) {
  if (!d) return '-';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('es-PA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch (_) {
    return '-';
  }
}

function formatDateTime(d) {
  if (!d) return '-';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });
  } catch (_) {
    return '-';
  }
}

/** Fila de medición por alojamiento con al menos X1, Y1 o unidad (misma regla que las tablas de medición del PDF). */
function housingMeasurementRowHasData(hm) {
  return (
    (hm.x1 != null && hm.x1 !== '') ||
    (hm.y1 != null && hm.y1 !== '') ||
    (hm.unit != null && hm.unit !== '')
  );
}

/**
 * Cuenta alojamientos del servicio que figuran en la medición final del reporte con datos registrados.
 * Usa la misma medición final que la sección "Mediciones finales" (la más reciente con datos).
 */
function countExecutedHousingsWithFinalMeasurement(svc, finalMeasurement) {
  if (!finalMeasurement) return 0;
  const rows = finalMeasurement.housing_measurements || finalMeasurement.housingMeasurements || [];
  const housings = svc.housings || [];
  const withData = new Set();
  for (const hm of rows) {
    const hid = hm.housing_id ?? hm.housingId;
    if (hid == null || !housings.some((h) => h.id == hid)) continue;
    if (!housingMeasurementRowHasData(hm)) continue;
    withData.add(String(hid));
  }
  return withData.size;
}

/** Altura de texto con ajuste de línea (PDFKit); mínimo una línea. */
function heightOfWrappedText(doc, text, width) {
  const s = text != null && text !== '' ? String(text) : '-';
  const h = doc.heightOfString(s, { width: Math.max(1, width) });
  const line = doc.currentLineHeight(true);
  return Math.max(line, h);
}

/** Altura de fila de tabla: el máximo de las celdas (evita solapamiento al envolver descripción). */
function measurementRowHeight(doc, cells) {
  const line = doc.currentLineHeight(true);
  let maxH = line;
  for (const c of cells) {
    maxH = Math.max(maxH, heightOfWrappedText(doc, c.text, c.width));
  }
  return maxH + 6;
}

/** Altura de una fila de tabla medición inicial/final. */
function measurementTableRowHeight(doc, hm, byId, MET_COL) {
  const hHousing = byId(hm.housing_id);
  const descStr = hm.housing_description || hHousing?.description || '-';
  const nom =
    hm.nominal_value != null
      ? `${hm.nominal_value} ${(hm.nominal_unit || '').trim()}`.trim() || '-'
      : hHousing && hHousing.nominal_value != null
        ? `${hHousing.nominal_value} ${hHousing.nominal_unit || ''}`.trim()
        : '-';
  return measurementRowHeight(doc, [
    { text: hm.measure_code || hHousing?.measure_code || '-', width: MET_COL.med },
    { text: descStr, width: MET_COL.desc },
    { text: nom, width: MET_COL.nom },
    { text: String(hm.tolerance ?? hHousing?.tolerance ?? '-'), width: MET_COL.tol },
    { text: String(hm.x1 ?? '-'), width: MET_COL.x1 },
    { text: String(hm.y1 ?? '-'), width: MET_COL.y1 },
    { text: String(hm.unit ?? '-'), width: MET_COL.un },
  ]);
}

/**
 * Espacio vertical necesario para: línea Fecha + cabeceras de tabla + regla + 1ª fila (si hay filas).
 * Así el título de sección no queda huérfano y no exigimos altura imposible si hay muchas filas.
 */
function spaceForMeasurementTableStart(doc, m, byId, MET_COL) {
  const hmList = m.housing_measurements || m.housingMeasurements || [];
  let h = 12;
  if (hmList.length === 0) return h;
  doc.font('Helvetica').fontSize(9);
  const firstRowH = measurementTableRowHeight(doc, hmList[0], byId, MET_COL);
  h += 14 + 8 + firstRowH;
  return h;
}

function getReportDate(order) {
  const d = order.completion_date;
  if (!d) return { day: '-', month: '-', year: '-' };
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return { day: '-', month: '-', year: '-' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear())
  };
}

/** Ruta absoluta imagen firma superintendente adjunta por admin */
function getSuperintendentSignatureFilePath(order) {
  const fp = (order.superintendent_signature_path || '').trim();
  const name = path.basename(fp.replace(/^\/+/, ''));
  if (!name) return null;
  return path.join(__dirname, '..', 'uploads', 'signatures', name);
}

/** Dibuja el pie de página con datos de contacto (en la página actual, al final). */
function drawFooter(doc) {
  const y = PAGE_HEIGHT - MARGIN - 24;
  doc.strokeColor('#ccc').lineWidth(0.5).moveTo(MARGIN, y - 6).lineTo(PAGE_WIDTH - MARGIN, y - 6).stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#555');
  doc.text(FOOTER_TEXT, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
  doc.strokeColor('black').lineWidth(1);
}

/** Zona inferior reservada para el pie (evitar contenido aquí). */
const FOOTER_ZONE_TOP = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

/**
 * Si no hay espacio suficiente, añade página y encabezado. En pageAdded se dibuja el pie en la página anterior.
 * Devuelve la y para seguir.
 */
function ensureSpace(doc, reportDate, currentY, neededHeight) {
  if (currentY + neededHeight <= FOOTER_ZONE_TOP) return currentY;
  doc.addPage();
  drawHeader(doc, reportDate);
  return CONTENT_TOP + TITLE_MARGIN_BELOW_HEADER;
}

export async function generateWorkOrderReport(orderData) {
  const documentsForReport = orderData.documents || [];
  const blueprintCandidates = documentsForReport.filter(
    (d) =>
      isDocumentVisibleForReport(d) &&
      (d.document_type === 'blueprint' ||
        (d.file_name && /\.(pdf|png|jpg|jpeg|gif|webp)$/i.test(d.file_name)))
  );
  const imagePlanos = blueprintCandidates.filter((d) => d.file_name && IMAGE_EXT.test(d.file_name));
  const pdfPlanosForMerge = blueprintCandidates.filter((d) => d.file_name && /\.pdf$/i.test(d.file_name));

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.on('pageAdded', () => {
      const range = doc.bufferedPageRange();
      if (range && range.count > 1) {
        const prevPageIndex = range.count - 2;
        doc.switchToPage(prevPageIndex);
        drawFooter(doc);
        doc.switchToPage(prevPageIndex + 1);
      }
    });

    const order = orderData;
    const services = order.services || [];
    const serviceHousings = order.service_housings || [];
    const measurements = order.measurements || [];
    const measurementHasData = (m) => {
      const housings = m.housing_measurements || m.housingMeasurements || [];
      if (!Array.isArray(housings) || housings.length === 0) return false;
      return housings.some((hm) => (hm.x1 != null && hm.x1 !== '') || (hm.y1 != null && hm.y1 !== '') || (hm.unit != null && hm.unit !== ''));
    };
    const getDate = (m) => {
      const d = m.measurement_date || m.measurementDate;
      return d ? new Date(d).getTime() : 0;
    };
    const initialMeasurements = measurements
      .filter((m) => (m.measurement_type || m.measurementType || '').toLowerCase() === 'initial')
      .filter(measurementHasData)
      .sort((a, b) => getDate(b) - getDate(a))
      .slice(0, 1);
    const finalMeasurements = measurements
      .filter((m) => (m.measurement_type || m.measurementType || '').toLowerCase() === 'final')
      .filter(measurementHasData)
      .sort((a, b) => getDate(b) - getDate(a))
      .slice(0, 1);
    const photos = order.photos || [];
    const reportDate = getReportDate(order);

    let y = CONTENT_TOP;

    // ----- PÁGINA 1 -----
    drawHeader(doc, reportDate);

    y += TITLE_MARGIN_BELOW_HEADER;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('black').text('REPORTE DE ORDEN DE TRABAJO', MARGIN, y);
    y += 22;

    doc.font('Helvetica').fontSize(10);
    doc.text(`Fecha: ${formatDate(order.completion_date)}`, MARGIN, y);
    doc.text(`Cliente: ${order.client_name || '-'}${order.company_name ? ' - ' + order.company_name : ''}`, MARGIN + 200, y);
    y += 16;
    doc.text(`N° Orden de Servicio del Cliente: ${order.client_service_order_number || '-'}`, MARGIN, y);
    doc.text(`Técnico CIGSA: ${order.technician_name || '-'}`, MARGIN + 280, y);
    y += 16;
    doc.text(`Serie WO: ${order.order_number || '-'}`, MARGIN, y);
    doc.text(`Área / Ubicación: ${order.service_location || '-'}`, MARGIN + 200, y);
    y += 20;

    doc.font('Helvetica-Bold').text('Equipo', MARGIN, y);
    y += 14;
    doc.font('Helvetica');
    doc.text(`Marca: ${order.brand_name || '-'}  |  Modelo: ${order.model_name || '-'}  |  Serie: ${order.serial_number || '-'}`, MARGIN, y);
    y += 12;
    if (order.equipment_components) {
      doc.fontSize(9).text(`Componentes: ${order.equipment_components}`, MARGIN, y);
      y += 14;
    }
    doc.fontSize(10);
    y += 10;

    doc.font('Helvetica-Bold').text('DESCRIPCIÓN DE SERVICIOS', MARGIN, y);
    y += 16;
    doc.font('Helvetica');
    if (services.length === 0) {
      doc.text('(Sin servicios registrados)', MARGIN, y);
      y += 14;
    } else {
      services.forEach((svc) => {
        const name = svc.service_name || svc.service_code || 'Servicio';
        const count = (svc.housings && svc.housings.length) || svc.housing_count || 0;
        doc.text(`• ${name} (${count} alojamiento${count !== 1 ? 's' : ''})`, MARGIN + 10, y);
        y += 14;
      });
    }
    y += 8;

    const tableEstimatedHeight = 20 + services.length * 28 + 20;
    y = ensureSpace(doc, reportDate, y, tableEstimatedHeight);

    doc.font('Helvetica-Bold').fontSize(9);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fillAndStroke('#eee', '#333');
    doc.fillColor('black').text('Servicio', MARGIN + 8, y + 4, { width: 280 });
    doc.text('Aloj. cotizados', MARGIN + 290, y + 4, { width: 80 });
    doc.text('Aloj. ejecutados', MARGIN + 372, y + 4);
    y += 20;
    doc.font('Helvetica').fontSize(9).fillColor('black');
    const serviceColWidth = 280;
    services.forEach((svc) => {
      const cot = svc.housing_count || 0;
      const ejec = countExecutedHousingsWithFinalMeasurement(svc, finalMeasurements[0] || null);
      const name = svc.service_name || svc.service_code || '-';
      const nameHeight = doc.heightOfString(name, { width: serviceColWidth });
      const rowHeight = Math.max(20, Math.ceil(nameHeight) + 10);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).stroke();
      doc.text(name, MARGIN + 8, y + 5, { width: serviceColWidth });
      doc.text(String(cot), MARGIN + 290, y + 5, { width: 80 });
      doc.text(String(ejec), MARGIN + 372, y + 5);
      y += rowHeight;
    });
    y += 16;

    if (order.description) {
      const descHeight = 50;
      y = ensureSpace(doc, reportDate, y, descHeight);
      doc.font('Helvetica-Bold').text('Observaciones', MARGIN, y);
      y += 12;
      doc.font('Helvetica').text(order.description, MARGIN, y, { width: CONTENT_WIDTH });
      y += 30;
    }

    // Firma del Superintendente (solo si hay imagen adjunta o firma legacy en BD)
    const conformitySuperintendente = order.conformity_signature_superintendente || null;
    const supFilePath = getSuperintendentSignatureFilePath(order);
    const hasSupFile = supFilePath && fs.existsSync(supFilePath);
    const supLegacyBuf = conformitySuperintendente?.signature_data
      ? signatureDataToBuffer(conformitySuperintendente.signature_data)
      : null;
    if (hasSupFile || supLegacyBuf) {
      const signatureBlockHeight = 100;
      y = ensureSpace(doc, reportDate, y, signatureBlockHeight);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Firma del Superintendente', MARGIN, y);
      y += 18;
      if (hasSupFile) {
        try {
          doc.image(supFilePath, MARGIN, y, { width: 180, height: 60, fit: [180, 60] });
          y += 62;
        } catch (_) {
          doc.font('Helvetica').fontSize(9).fillColor('#555').text('(Imagen de firma no disponible)', MARGIN, y);
          y += 16;
        }
        doc.font('Helvetica').fontSize(10).fillColor('black');
        const supName = order.superintendent_signature_signed_by || '-';
        doc.text(`Nombre: ${supName}`, MARGIN, y);
        y += 14;
        doc.text(`Fecha: ${formatDateTime(order.superintendent_signature_signed_at)}`, MARGIN, y);
        y += 22;
      } else if (supLegacyBuf) {
        try {
          doc.image(supLegacyBuf, MARGIN, y, { width: 180, height: 60, fit: [180, 60] });
          y += 62;
        } catch (_) {
          doc.font('Helvetica').fontSize(9).fillColor('#555').text('(Imagen de firma no disponible)', MARGIN, y);
          y += 16;
        }
        doc.font('Helvetica').fontSize(10).fillColor('black');
        doc.text(`Nombre: ${conformitySuperintendente.signed_by_name || '-'}`, MARGIN, y);
        y += 14;
        doc.text(`Fecha: ${formatDateTime(conformitySuperintendente.signed_at)}`, MARGIN, y);
        y += 22;
      }
    }

    doc.addPage();
    y = CONTENT_TOP + TITLE_MARGIN_BELOW_HEADER;

    // ----- PÁGINA 2: PLANOS/DOCUMENTOS (al inicio) y METROLOGÍA -----
    drawHeader(doc, reportDate);

    if (imagePlanos.length > 0 || pdfPlanosForMerge.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Planos / Documentos', MARGIN, y);
      y += 16;
      doc.font('Helvetica').fontSize(9);
      if (imagePlanos.length > 0) {
        imagePlanos.forEach((d) => {
          y = ensureSpace(doc, reportDate, y, PLANO_ITEM_HEIGHT);
          const absPath = getDocumentFilePath(d);
          const name = d.file_name || 'Documento';
          if (absPath && fs.existsSync(absPath)) {
            try {
              doc.image(absPath, MARGIN, y, { fit: [CONTENT_WIDTH, MAX_PLANO_IMAGE_HEIGHT], align: 'center', valign: 'top' });
              y += MAX_PLANO_IMAGE_HEIGHT + 4;
              doc.fillColor('#333').text(name, MARGIN, y, { width: CONTENT_WIDTH });
              y += 14;
            } catch (_) {
              doc.text(`• ${name}`, MARGIN + 10, y);
              y += 14;
            }
          } else {
            doc.text(`• ${name}`, MARGIN + 10, y);
            y += 14;
          }
        });
      }
      if (pdfPlanosForMerge.length > 0) {
        const pdfListH = 18 + pdfPlanosForMerge.length * 14 + 8;
        y = ensureSpace(doc, reportDate, y, pdfListH);
        if (imagePlanos.length > 0) y += 6;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('Planos PDF (páginas anexadas al final de este reporte)', MARGIN, y);
        y += 14;
        doc.font('Helvetica').fontSize(9);
        pdfPlanosForMerge.forEach((d) => {
          const name = d.file_name || 'Plano.pdf';
          doc.text(`• ${name}`, MARGIN + 10, y);
          y += 14;
        });
        y += 4;
      }
      doc.fillColor('black');
      y += 16;
    }

    doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('METROLOGÍA DE ALOJAMIENTOS', MARGIN, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').text(`Equipo: ${order.serial_number || '-'}  |  N° Orden Cliente: ${order.client_service_order_number || '-'}`, MARGIN, y);
    y += 20;

    const housings = serviceHousings.length ? serviceHousings : [];
    const byId = (id) => housings.find((h) => h.id === id) || {};

    const medColW = 38;
    const nomColW = 54;
    const tolColW = 54;
    const unitColW = 34;
    const descColW = CONTENT_WIDTH - medColW - nomColW - tolColW - unitColW;
    const xNom = MARGIN + medColW + descColW;
    const xTol = xNom + nomColW;
    const xUnit = xTol + tolColW;

    if (housings.length === 0) {
      y = ensureSpace(doc, reportDate, y, 14 + 20);
    } else {
      doc.font('Helvetica').fontSize(9);
      const h0 = housings[0];
      const row0H = measurementRowHeight(doc, [
        { text: h0.measure_code || '-', width: medColW },
        { text: h0.description || '-', width: descColW },
        { text: h0.nominal_value != null ? String(h0.nominal_value) : '-', width: nomColW },
        { text: h0.tolerance || '-', width: tolColW },
        { text: h0.nominal_unit || '-', width: unitColW },
      ]);
      y = ensureSpace(doc, reportDate, y, 14 + 14 + 8 + row0H);
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('MEDIDAS NOMINALES', MARGIN, y);
    y += 14;
    if (housings.length === 0) {
      doc.font('Helvetica').text('Sin alojamientos definidos.', MARGIN, y);
      y += 20;
    } else {
      doc.font('Helvetica').fontSize(9);
      doc.text('Medida', MARGIN, y, { width: medColW });
      doc.text('Descripción', MARGIN + medColW, y, { width: descColW });
      doc.text('Nominal', xNom, y, { width: nomColW });
      doc.text('Tolerancia', xTol, y, { width: tolColW });
      doc.text('Unidad', xUnit, y, { width: unitColW });
      y += 14;
      doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
      y += 8;
      housings.forEach((h, rowIdx) => {
        const descStr = h.description || '-';
        const nom = h.nominal_value != null ? String(h.nominal_value) : '-';
        const tol = h.tolerance || '-';
        const unit = h.nominal_unit || '-';
        const rowH = measurementRowHeight(doc, [
          { text: h.measure_code || '-', width: medColW },
          { text: descStr, width: descColW },
          { text: nom, width: nomColW },
          { text: tol, width: tolColW },
          { text: unit, width: unitColW },
        ]);
        if (rowIdx > 0) {
          y = ensureSpace(doc, reportDate, y, rowH);
        }
        doc.text(h.measure_code || '-', MARGIN, y, { width: medColW });
        doc.text(descStr, MARGIN + medColW, y, { width: descColW });
        doc.text(nom, xNom, y, { width: nomColW });
        doc.text(tol, xTol, y, { width: tolColW });
        doc.text(unit, xUnit, y, { width: unitColW });
        y += rowH;
      });
      y += 16;
    }

    /** Columnas medidas inicial/final: descripción usa el ancho restante del contenido. */
    const MET_COL = { med: 40, nom: 56, tol: 48, x1: 44, y1: 44, un: 32 };
    MET_COL.desc = CONTENT_WIDTH - MET_COL.med - MET_COL.nom - MET_COL.tol - MET_COL.x1 - MET_COL.y1 - MET_COL.un;
    const metX = {
      med: MARGIN,
      desc: MARGIN + MET_COL.med,
      nom: MARGIN + MET_COL.med + MET_COL.desc,
      tol: MARGIN + MET_COL.med + MET_COL.desc + MET_COL.nom,
      x1: MARGIN + MET_COL.med + MET_COL.desc + MET_COL.nom + MET_COL.tol,
      y1: MARGIN + MET_COL.med + MET_COL.desc + MET_COL.nom + MET_COL.tol + MET_COL.x1,
      un: MARGIN + MET_COL.med + MET_COL.desc + MET_COL.nom + MET_COL.tol + MET_COL.x1 + MET_COL.y1,
    };

    {
      const titleH = 14;
      const needBeforeTitle =
        initialMeasurements.length === 0
          ? titleH + 20
          : titleH + spaceForMeasurementTableStart(doc, initialMeasurements[0], byId, MET_COL);
      y = ensureSpace(doc, reportDate, y, needBeforeTitle);
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('MEDIDAS INICIALES', MARGIN, y);
    y += 14;
    if (initialMeasurements.length === 0) {
      doc.font('Helvetica').text('Sin mediciones iniciales registradas.', MARGIN, y);
      y += 20;
    } else {
      initialMeasurements.forEach((m, idx) => {
        const hmList = m.housing_measurements || m.housingMeasurements || [];
        if (idx > 0) {
          y = ensureSpace(doc, reportDate, y, spaceForMeasurementTableStart(doc, m, byId, MET_COL));
        }
        doc.font('Helvetica').fontSize(9).fillColor('black').text(`Fecha: ${formatDateTime(m.measurement_date)}`, MARGIN, y);
        y += 12;
        if (hmList.length > 0) {
          doc.font('Helvetica').fontSize(9);
          doc.text('Medida', metX.med, y, { width: MET_COL.med });
          doc.text('Descripción', metX.desc, y, { width: MET_COL.desc });
          doc.text('Nominal', metX.nom, y, { width: MET_COL.nom });
          doc.text('Tolerancia', metX.tol, y, { width: MET_COL.tol });
          doc.text('X1', metX.x1, y, { width: MET_COL.x1 });
          doc.text('Y1', metX.y1, y, { width: MET_COL.y1 });
          doc.text('Unidad', metX.un, y, { width: MET_COL.un });
          y += 14;
          doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
          y += 8;
          doc.font('Helvetica').fontSize(9);
          hmList.forEach((hm, rowIdx) => {
            const h = byId(hm.housing_id);
            const rowH = measurementTableRowHeight(doc, hm, byId, MET_COL);
            if (rowIdx > 0) {
              y = ensureSpace(doc, reportDate, y, rowH);
            }
            const descStr = hm.housing_description || h?.description || '-';
            const nom = (hm.nominal_value != null) ? `${hm.nominal_value} ${(hm.nominal_unit || '').trim()}`.trim() || '-' : (h && (h.nominal_value != null) ? `${h.nominal_value} ${h.nominal_unit || ''}`.trim() : '-');
            doc.text(hm.measure_code || h?.measure_code || '-', metX.med, y, { width: MET_COL.med });
            doc.text(descStr, metX.desc, y, { width: MET_COL.desc });
            doc.text(nom, metX.nom, y, { width: MET_COL.nom });
            doc.text(String(hm.tolerance ?? h?.tolerance ?? '-'), metX.tol, y, { width: MET_COL.tol });
            doc.text(String(hm.x1 ?? '-'), metX.x1, y, { width: MET_COL.x1 });
            doc.text(String(hm.y1 ?? '-'), metX.y1, y, { width: MET_COL.y1 });
            doc.text(String(hm.unit ?? '-'), metX.un, y, { width: MET_COL.un });
            y += rowH;
          });
          y += 4;
          if (m.notes) {
            const notesText = `Observaciones: ${m.notes}`;
            doc.font('Helvetica').fontSize(8).fillColor('#555');
            const noteH = doc.heightOfString(notesText, { width: CONTENT_WIDTH }) + 6;
            y = ensureSpace(doc, reportDate, y, noteH);
            doc.text(notesText, MARGIN, y, { width: CONTENT_WIDTH });
            y += noteH;
          }
          y += 8;
        }
      });
    }

    {
      const titleH = 14;
      const needBeforeTitle =
        finalMeasurements.length === 0
          ? titleH + 20
          : titleH + spaceForMeasurementTableStart(doc, finalMeasurements[0], byId, MET_COL);
      y = ensureSpace(doc, reportDate, y, needBeforeTitle);
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('MEDIDAS FINALES', MARGIN, y);
    y += 14;
    if (finalMeasurements.length === 0) {
      doc.font('Helvetica').text('Sin mediciones finales registradas.', MARGIN, y);
      y += 20;
    } else {
      finalMeasurements.forEach((m, idx) => {
        const hmList = m.housing_measurements || m.housingMeasurements || [];
        if (idx > 0) {
          y = ensureSpace(doc, reportDate, y, spaceForMeasurementTableStart(doc, m, byId, MET_COL));
        }
        doc.font('Helvetica').fontSize(9).fillColor('black').text(`Fecha: ${formatDateTime(m.measurement_date)}`, MARGIN, y);
        y += 12;
        if (hmList.length > 0) {
          doc.font('Helvetica').fontSize(9);
          doc.text('Medida', metX.med, y, { width: MET_COL.med });
          doc.text('Descripción', metX.desc, y, { width: MET_COL.desc });
          doc.text('Nominal', metX.nom, y, { width: MET_COL.nom });
          doc.text('Tolerancia', metX.tol, y, { width: MET_COL.tol });
          doc.text('X1', metX.x1, y, { width: MET_COL.x1 });
          doc.text('Y1', metX.y1, y, { width: MET_COL.y1 });
          doc.text('Unidad', metX.un, y, { width: MET_COL.un });
          y += 14;
          doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
          y += 8;
          doc.font('Helvetica').fontSize(9);
          hmList.forEach((hm, rowIdx) => {
            const h = byId(hm.housing_id);
            const rowH = measurementTableRowHeight(doc, hm, byId, MET_COL);
            if (rowIdx > 0) {
              y = ensureSpace(doc, reportDate, y, rowH);
            }
            const descStr = hm.housing_description || h?.description || '-';
            const nom = (hm.nominal_value != null) ? `${hm.nominal_value} ${(hm.nominal_unit || '').trim()}`.trim() || '-' : (h && (h.nominal_value != null) ? `${h.nominal_value} ${h.nominal_unit || ''}`.trim() : '-');
            doc.text(hm.measure_code || h?.measure_code || '-', metX.med, y, { width: MET_COL.med });
            doc.text(descStr, metX.desc, y, { width: MET_COL.desc });
            doc.text(nom, metX.nom, y, { width: MET_COL.nom });
            doc.text(String(hm.tolerance ?? h?.tolerance ?? '-'), metX.tol, y, { width: MET_COL.tol });
            doc.text(String(hm.x1 ?? '-'), metX.x1, y, { width: MET_COL.x1 });
            doc.text(String(hm.y1 ?? '-'), metX.y1, y, { width: MET_COL.y1 });
            doc.text(String(hm.unit ?? '-'), metX.un, y, { width: MET_COL.un });
            y += rowH;
          });
          y += 4;
          if (m.notes) {
            const notesText = `Observaciones: ${m.notes}`;
            doc.font('Helvetica').fontSize(8).fillColor('#555');
            const noteH = doc.heightOfString(notesText, { width: CONTENT_WIDTH }) + 6;
            y = ensureSpace(doc, reportDate, y, noteH);
            doc.text(notesText, MARGIN, y, { width: CONTENT_WIDTH });
            y += noteH;
          }
          y += 8;
        }
      });
    }

    // Firma del Capataz al final de la página 2 (después de medidas finales)
    const conformityCapataz = order.conformity_signature_capataz || null;
    const signatureBlockHeight2 = 100;
    y = ensureSpace(doc, reportDate, y, signatureBlockHeight2);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Firma del Capataz que recibe el trabajo', MARGIN, y);
    y += 18;
    if (conformityCapataz && conformityCapataz.signature_data) {
      const sigBufCap = signatureDataToBuffer(conformityCapataz.signature_data);
      if (sigBufCap) {
        try {
          doc.image(sigBufCap, MARGIN, y, { width: 180, height: 60, fit: [180, 60] });
          y += 62;
        } catch (_) {
          doc.font('Helvetica').fontSize(9).fillColor('#555').text('(Imagen de firma no disponible)', MARGIN, y);
          y += 16;
        }
      } else {
        doc.font('Helvetica').fontSize(9).fillColor('#555').text('(Firma no disponible)', MARGIN, y);
        y += 16;
      }
      doc.font('Helvetica').fontSize(10).fillColor('black');
      doc.text(`Nombre: ${conformityCapataz.signed_by_name || '-'}`, MARGIN, y);
      y += 14;
      doc.text(`Fecha: ${formatDateTime(conformityCapataz.signed_at)}`, MARGIN, y);
      y += 22;
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#555').text('Sin firma registrada.', MARGIN, y);
      y += 24;
    }

    doc.font('Helvetica').fontSize(8).fillColor('#555');
    doc.text(`Reporte OT: ${order.order_number || order.id} - ${formatDate(order.created_at)}`, MARGIN, y + 10);

    // ----- PÁGINA(S) SIGUIENTE(S): ANEXOS FOTOGRÁFICOS (3 fotos por fila) -----
    const photosForAnnex = photos || [];
    const photoTypes = { inspection: 'Inspección', during_service: 'Durante el servicio', completion: 'Finalización' };
    const PHOTOS_PER_ROW = 3;
    const photoGap = 8;
    const photoCellW = (CONTENT_WIDTH - (PHOTOS_PER_ROW - 1) * photoGap) / PHOTOS_PER_ROW;
    const photoCellH = 110;
    const photoRowHeight = photoCellH + 18;

    doc.addPage();
    y = CONTENT_TOP + TITLE_MARGIN_BELOW_HEADER;
    drawHeader(doc, reportDate);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Anexos Fotográficos', MARGIN, y);
    y += 20;

    if (photosForAnnex.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#555').text('No hay fotos adjuntas para esta orden de trabajo.', MARGIN, y);
      y += 20;
    } else {
      const rows = [];
      for (let i = 0; i < photosForAnnex.length; i += PHOTOS_PER_ROW) {
        rows.push(photosForAnnex.slice(i, i + PHOTOS_PER_ROW));
      }
      rows.forEach((rowPhotos) => {
        y = ensureSpace(doc, reportDate, y, photoRowHeight);
        const rowStartY = y;
        rowPhotos.forEach((photo, colIndex) => {
          const absPath = getPhotoFilePath(photo);
          const x = MARGIN + colIndex * (photoCellW + photoGap);
          if (absPath && fs.existsSync(absPath)) {
            try {
              doc.image(absPath, x, y, { fit: [photoCellW, photoCellH], align: 'center', valign: 'top' });
            } catch (_) {
              doc.font('Helvetica').fontSize(7).fillColor('#888').text('(Error)', x, y + photoCellH / 2 - 4, { width: photoCellW, align: 'center' });
            }
          } else {
            doc.font('Helvetica').fontSize(7).fillColor('#888').text('(No encontrada)', x, y + photoCellH / 2 - 4, { width: photoCellW, align: 'center' });
          }
        });
        y += photoCellH + 6;
        doc.font('Helvetica').fontSize(8).fillColor('#333');
        rowPhotos.forEach((photo, colIndex) => {
          const typeLabel = photoTypes[photo.photo_type] || photo.photo_type || 'Foto';
          const caption = (photo.description ? `${typeLabel}: ${(photo.description || '').slice(0, 25)}` : typeLabel).slice(0, 28);
          const x = MARGIN + colIndex * (photoCellW + photoGap);
          doc.text(caption, x, y, { width: photoCellW, align: 'center' });
        });
        y += 14;
      });
    }

    drawFooter(doc);
    doc.end();
  });

  return appendBlueprintPdfPages(pdfBuffer, pdfPlanosForMerge);
}
