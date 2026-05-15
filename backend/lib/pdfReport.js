/**
 * Genera el PDF del reporte de OT con encabezado y pie en todas las páginas.
 * Recibe el objeto completo de la OT (como GET /work-orders/:id).
 */
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isMachiningRepairTypeName } from './serviceTypeMachining.js';

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

/** Componentes de una línea de servicio (o legacy con alojamientos planos en el servicio). */
function serviceComponentsList(svc) {
  const comps = svc?.components;
  if (Array.isArray(comps) && comps.length > 0) return comps;
  const housings = svc?.housings || [];
  if (housings.length === 0) return [];
  return [
    {
      component_name: 'Componente General',
      component_id: null,
      housings,
      housing_count: housings.length
    }
  ];
}

function housingCountForComponent(comp) {
  const list = comp?.housings;
  if (Array.isArray(list) && list.length > 0) return list.length;
  return Number(comp?.housing_count) || 0;
}

function totalHousingCountForService(svc) {
  const comps = serviceComponentsList(svc);
  if (comps.length > 0) {
    return comps.reduce((sum, c) => sum + housingCountForComponent(c), 0);
  }
  return (svc?.housings?.length || svc?.housing_count) || 0;
}

function housingBelongsToComponent(h, comp) {
  const compId = comp?.component_id ?? comp?.componentId;
  if (compId != null && h.component_id != null) {
    return String(h.component_id) === String(compId);
  }
  const woscId = comp?.id;
  if (woscId != null && h.work_order_service_component_id != null) {
    return String(h.work_order_service_component_id) === String(woscId);
  }
  const compName = comp?.component_name;
  if (compName && h.component_name) return h.component_name === compName;
  const compHousings = comp?.housings || [];
  if (compHousings.length > 0) {
    return compHousings.some((ch) => ch.id != null && h.id != null && String(ch.id) === String(h.id));
  }
  return serviceComponentsList({ components: [comp] }).length === 1;
}

function housingComponentLabel(h, hm) {
  return (
    hm?.component_name ||
    h?.component_name ||
    'Componente General'
  );
}

function housingServiceLabel(h, hm, orderServices) {
  const fromHm = [hm?.service_code, hm?.service_name].filter(Boolean).join(' — ');
  if (fromHm) return fromHm;
  const fromH = [h?.service_code, h?.service_name].filter(Boolean).join(' — ');
  if (fromH) return fromH;
  const wosId = h?.work_order_service_id ?? hm?.work_order_service_id;
  if (wosId != null && Array.isArray(orderServices)) {
    const s = orderServices.find((x) => String(x.id) === String(wosId));
    if (s) return [s.service_code, s.service_name].filter(Boolean).join(' — ') || '-';
  }
  return '-';
}

/**
 * Cuenta alojamientos del componente con medición final registrada (X1/Y1/unidad).
 */
function countExecutedHousingsForComponent(comp, finalMeasurement) {
  if (!finalMeasurement) return 0;
  const rows = finalMeasurement.housing_measurements || finalMeasurement.housingMeasurements || [];
  const compHousings = comp?.housings || [];
  const withData = new Set();
  for (const hm of rows) {
    const hid = hm.housing_id ?? hm.housingId;
    if (hid == null) continue;
    const hMatch =
      compHousings.some((h) => h.id == hid) ||
      (comp?.component_name && hm.component_name === comp.component_name);
    if (!hMatch) continue;
    if (!housingMeasurementRowHasData(hm)) continue;
    withData.add(String(hid));
  }
  return withData.size;
}

/**
 * Cuenta alojamientos del servicio que figuran en la medición final del reporte con datos registrados.
 */
function countExecutedHousingsWithFinalMeasurement(svc, finalMeasurement) {
  if (!finalMeasurement) return 0;
  const comps = serviceComponentsList(svc);
  if (comps.length === 0) return 0;
  return comps.reduce((sum, c) => sum + countExecutedHousingsForComponent(c, finalMeasurement), 0);
}

const PHOTO_GROUP_NONE = '__none__';

function photoGroupKey(photo) {
  const id = photo.work_order_service_id ?? photo.workOrderServiceId;
  if (id != null && id !== '') return String(id);
  return PHOTO_GROUP_NONE;
}

function photoServiceTitleForGroup(firstPhoto, orderServices) {
  const p = firstPhoto;
  const code = p?.photo_service_code ?? p?.photoServiceCode;
  const name = p?.photo_service_name ?? p?.photoServiceName;
  if (code || name) {
    const t = [code, name].filter(Boolean).join(' — ');
    if (t) return t;
  }
  const wosId = p?.work_order_service_id ?? p?.workOrderServiceId;
  if (wosId != null && Array.isArray(orderServices)) {
    const s = orderServices.find((x) => String(x.id) === String(wosId));
    if (s) {
      const t = [s.service_code, s.service_name].filter(Boolean).join(' — ');
      if (t) return t;
    }
  }
  return 'Sin servicio asignado';
}

/**
 * Agrupa fotos por servicio (línea work_order_services) y ordena secciones como en la lista de servicios de la OT.
 */
function buildPhotoAnnexGroups(photos, orderServices) {
  const list = Array.isArray(photos) ? photos : [];
  const byKey = new Map();
  for (const p of list) {
    const k = photoGroupKey(p);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(p);
  }
  for (const arr of byKey.values()) {
    arr.sort((a, b) => {
      const ta = new Date(a.created_at || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.createdAt || 0).getTime();
      return ta - tb;
    });
  }
  const svcs = Array.isArray(orderServices) ? orderServices : [];
  const ordered = [];
  const used = new Set();
  for (const s of svcs) {
    if (s && s.id != null) {
      const k = String(s.id);
      const arr = byKey.get(k);
      if (arr && arr.length > 0) {
        ordered.push({ key: k, title: photoServiceTitleForGroup(arr[0], orderServices), photos: arr });
        used.add(k);
      }
    }
  }
  const rest = [...byKey.keys()].filter((k) => !used.has(k));
  rest.sort((a, b) => {
    if (a === PHOTO_GROUP_NONE) return 1;
    if (b === PHOTO_GROUP_NONE) return -1;
    const ta = photoServiceTitleForGroup(byKey.get(a)[0], orderServices);
    const tb = photoServiceTitleForGroup(byKey.get(b)[0], orderServices);
    return String(ta).localeCompare(String(tb), 'es');
  });
  for (const k of rest) {
    const arr = byKey.get(k);
    if (arr && arr.length > 0) {
      ordered.push({ key: k, title: photoServiceTitleForGroup(arr[0], orderServices), photos: arr });
    }
  }
  return ordered;
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
function measurementTableRowHeight(doc, hm, byId, MET_COL, orderServices) {
  const hHousing = byId(hm.housing_id);
  const descStr = hm.housing_description || hHousing?.description || '-';
  const nom =
    hm.nominal_value != null
      ? `${hm.nominal_value} ${(hm.nominal_unit || '').trim()}`.trim() || '-'
      : hHousing && hHousing.nominal_value != null
        ? `${hHousing.nominal_value} ${hHousing.nominal_unit || ''}`.trim()
        : '-';
  return measurementRowHeight(doc, [
    { text: housingServiceLabel(hHousing, hm, orderServices), width: MET_COL.svc },
    { text: housingComponentLabel(hHousing, hm), width: MET_COL.comp },
    { text: hm.measure_code || hHousing?.measure_code || '-', width: MET_COL.med },
    { text: descStr, width: MET_COL.desc },
    { text: nom, width: MET_COL.nom },
    { text: String(hm.tolerance ?? hHousing?.tolerance ?? '-'), width: MET_COL.tol },
    { text: String(hm.x1 ?? '-'), width: MET_COL.x1 },
    { text: String(hm.y1 ?? '-'), width: MET_COL.y1 },
    { text: String(hm.unit ?? '-'), width: MET_COL.un },
  ]);
}

function buildMetrologyColumns() {
  const MET_COL = { svc: 88, comp: 78, med: 34, nom: 48, tol: 42, x1: 38, y1: 38, un: 28 };
  MET_COL.desc =
    CONTENT_WIDTH - MET_COL.svc - MET_COL.comp - MET_COL.med - MET_COL.nom - MET_COL.tol - MET_COL.x1 - MET_COL.y1 - MET_COL.un;
  const metX = {
    svc: MARGIN,
    comp: MARGIN + MET_COL.svc,
    med: MARGIN + MET_COL.svc + MET_COL.comp,
    desc: MARGIN + MET_COL.svc + MET_COL.comp + MET_COL.med,
    nom: MARGIN + MET_COL.svc + MET_COL.comp + MET_COL.med + MET_COL.desc,
    tol: MARGIN + MET_COL.svc + MET_COL.comp + MET_COL.med + MET_COL.desc + MET_COL.nom,
    x1: MARGIN + MET_COL.svc + MET_COL.comp + MET_COL.med + MET_COL.desc + MET_COL.nom + MET_COL.tol,
    y1:
      MARGIN + MET_COL.svc + MET_COL.comp + MET_COL.med + MET_COL.desc + MET_COL.nom + MET_COL.tol + MET_COL.x1,
    un:
      MARGIN +
      MET_COL.svc +
      MET_COL.comp +
      MET_COL.med +
      MET_COL.desc +
      MET_COL.nom +
      MET_COL.tol +
      MET_COL.x1 +
      MET_COL.y1,
  };
  return { MET_COL, metX };
}

function drawMeasurementTableHeaders(doc, metX, MET_COL, y) {
  doc.font('Helvetica').fontSize(8);
  doc.text('Servicio', metX.svc, y, { width: MET_COL.svc });
  doc.text('Componente', metX.comp, y, { width: MET_COL.comp });
  doc.text('Medida', metX.med, y, { width: MET_COL.med });
  doc.text('Descripción', metX.desc, y, { width: MET_COL.desc });
  doc.text('Nominal', metX.nom, y, { width: MET_COL.nom });
  doc.text('Tolerancia', metX.tol, y, { width: MET_COL.tol });
  doc.text('X1', metX.x1, y, { width: MET_COL.x1 });
  doc.text('Y1', metX.y1, y, { width: MET_COL.y1 });
  doc.text('Unidad', metX.un, y, { width: MET_COL.un });
}

function drawMeasurementTableRow(doc, hm, byId, MET_COL, metX, y, orderServices) {
  const h = byId(hm.housing_id);
  const descStr = hm.housing_description || h?.description || '-';
  const nom =
    hm.nominal_value != null
      ? `${hm.nominal_value} ${(hm.nominal_unit || '').trim()}`.trim() || '-'
      : h && h.nominal_value != null
        ? `${h.nominal_value} ${h.nominal_unit || ''}`.trim()
        : '-';
  doc.font('Helvetica').fontSize(8);
  doc.text(housingServiceLabel(h, hm, orderServices), metX.svc, y, { width: MET_COL.svc });
  doc.text(housingComponentLabel(h, hm), metX.comp, y, { width: MET_COL.comp });
  doc.text(hm.measure_code || h?.measure_code || '-', metX.med, y, { width: MET_COL.med });
  doc.text(descStr, metX.desc, y, { width: MET_COL.desc });
  doc.text(nom, metX.nom, y, { width: MET_COL.nom });
  doc.text(String(hm.tolerance ?? h?.tolerance ?? '-'), metX.tol, y, { width: MET_COL.tol });
  doc.text(String(hm.x1 ?? '-'), metX.x1, y, { width: MET_COL.x1 });
  doc.text(String(hm.y1 ?? '-'), metX.y1, y, { width: MET_COL.y1 });
  doc.text(String(hm.unit ?? '-'), metX.un, y, { width: MET_COL.un });
}

/**
 * Espacio vertical necesario para: línea Fecha + cabeceras de tabla + regla + 1ª fila (si hay filas).
 * Así el título de sección no queda huérfano y no exigimos altura imposible si hay muchas filas.
 */
function spaceForMeasurementTableStart(doc, m, byId, MET_COL, orderServices) {
  const hmList = m.housing_measurements || m.housingMeasurements || [];
  let h = 12;
  if (hmList.length === 0) return h;
  doc.font('Helvetica').fontSize(8);
  const firstRowH = measurementTableRowHeight(doc, hmList[0], byId, MET_COL, orderServices);
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

/** Fila de datos en dos columnas (texto ajustado); evita solapar líneas largas p. ej. listas de técnicos. */
function drawReportHeaderDataRow(
  doc,
  reportDate,
  y,
  leftText,
  rightText,
  { leftW = 230, rightX, rightW } = {}
) {
  const rx = rightX ?? MARGIN + leftW + 8;
  const rw = rightW ?? PAGE_WIDTH - MARGIN - rx;
  doc.font('Helvetica').fontSize(10).fillColor('black');
  const hL = leftText != null && leftText !== '' ? doc.heightOfString(String(leftText), { width: leftW }) : 0;
  const hR = rightText != null && rightText !== '' ? doc.heightOfString(String(rightText), { width: rw }) : 0;
  const lineGap = 4;
  const rowH = Math.max(hL, hR, 11) + lineGap;
  const y0 = ensureSpace(doc, reportDate, y, rowH);
  if (leftText != null && leftText !== '') {
    doc.text(String(leftText), MARGIN, y0, { width: leftW });
  }
  if (rightText != null && rightText !== '') {
    doc.text(String(rightText), rx, y0, { width: rw });
  }
  return y0 + rowH;
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
    const showHousingMetrology = isMachiningRepairTypeName(order.service_type_name);
    const services = order.services || [];
    const serviceHousings = showHousingMetrology ? order.service_housings || [] : [];
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

    const headLeftW = 235;
    const headRightX = MARGIN + headLeftW + 10;
    const headRightW = PAGE_WIDTH - MARGIN - headRightX;
    y = drawReportHeaderDataRow(
      doc,
      reportDate,
      y,
      `Fecha: ${formatDate(order.completion_date)}`,
      `Cliente: ${order.client_name || '-'}${order.company_name ? ' - ' + order.company_name : ''}`,
      { leftW: headLeftW, rightX: headRightX, rightW: headRightW }
    );
    y = drawReportHeaderDataRow(
      doc,
      reportDate,
      y,
      `N° Orden de Servicio del Cliente: ${order.client_service_order_number || '-'}`,
      `Técnico CIGSA: ${order.technician_name || '-'}`,
      { leftW: headLeftW, rightX: headRightX, rightW: headRightW }
    );
    y = drawReportHeaderDataRow(
      doc,
      reportDate,
      y,
      `Serie WO: ${order.order_number || '-'}`,
      `Área / Ubicación: ${order.service_location || '-'}`,
      { leftW: headLeftW, rightX: headRightX, rightW: headRightW }
    );
    y += 8;

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
      const bulletW = CONTENT_WIDTH - 20;
      services.forEach((svc) => {
        const name = svc.service_name || svc.service_code || 'Servicio';
        const count = totalHousingCountForService(svc);
        const techBits =
          Array.isArray(svc.technicians) && svc.technicians.length > 0
            ? svc.technicians
                .map((t) => {
                  const nm = t.full_name || '';
                  const sh = t.shift === 'night' || t.shift === 'NS' ? 'Noche/NS' : 'Día/DS';
                  return nm ? `${nm} (${sh})` : '';
                })
                .filter(Boolean)
                .join(', ')
            : '';
        const techSuffix = techBits ? ` — ${techBits}` : '';
        const housingSuffix = showHousingMetrology
          ? ` (${count} alojamiento${count !== 1 ? 's' : ''})`
          : '';
        const line = `• ${name}${techSuffix}${housingSuffix}`;
        doc.font('Helvetica').fontSize(10);
        let blockH = doc.heightOfString(line, { width: bulletW });
        const comps = showHousingMetrology ? serviceComponentsList(svc) : [];
        for (const comp of comps) {
          const cCount = housingCountForComponent(comp);
          const compLine = `    ◦ ${comp.component_name || 'Componente'}: ${cCount} alojamiento${cCount !== 1 ? 's' : ''}`;
          blockH += doc.heightOfString(compLine, { width: bulletW - 12 }) + 4;
        }
        y = ensureSpace(doc, reportDate, y, blockH + 6);
        doc.text(line, MARGIN + 10, y, { width: bulletW });
        let subY = y + doc.heightOfString(line, { width: bulletW }) + 4;
        if (comps.length > 0) {
          doc.fontSize(9).fillColor('#444');
          for (const comp of comps) {
            const cCount = housingCountForComponent(comp);
            const compLine = `    ◦ ${comp.component_name || 'Componente'}: ${cCount} alojamiento${cCount !== 1 ? 's' : ''}`;
            doc.text(compLine, MARGIN + 18, subY, { width: bulletW - 12 });
            subY += doc.heightOfString(compLine, { width: bulletW - 12 }) + 3;
          }
          doc.fontSize(10).fillColor('black');
        }
        y = subY + 4;
      });
    }
    y += 8;

    if (showHousingMetrology) {
      let rowCount = 0;
      services.forEach((svc) => {
        const comps = serviceComponentsList(svc);
        rowCount += comps.length > 0 ? comps.length : 1;
      });
      const tableEstimatedHeight = 20 + rowCount * 28 + 20;
      y = ensureSpace(doc, reportDate, y, tableEstimatedHeight);

      const svcColW = 200;
      const compColW = 150;
      doc.font('Helvetica-Bold').fontSize(8);
      doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fillAndStroke('#eee', '#333');
      doc.fillColor('black').text('Servicio', MARGIN + 6, y + 5, { width: svcColW });
      doc.text('Componente', MARGIN + 6 + svcColW, y + 5, { width: compColW });
      doc.text('Aloj. cot.', MARGIN + 6 + svcColW + compColW, y + 5, { width: 56 });
      doc.text('Aloj. ejec.', MARGIN + 6 + svcColW + compColW + 56, y + 5);
      y += 20;
      doc.font('Helvetica').fontSize(8).fillColor('black');
      services.forEach((svc) => {
        const name = svc.service_name || svc.service_code || '-';
        const comps = serviceComponentsList(svc);
        const rows = comps.length > 0 ? comps : [{ component_name: '-', housing_count: svc.housing_count || 0, housings: [] }];
        rows.forEach((comp) => {
          const cot = housingCountForComponent(comp);
          const ejec = countExecutedHousingsForComponent(comp, finalMeasurements[0] || null);
          const compName = comp.component_name || 'Componente General';
          const rowH = Math.max(
            18,
            Math.ceil(doc.heightOfString(name, { width: svcColW - 4 })) +
              Math.ceil(doc.heightOfString(compName, { width: compColW - 4 })) +
              8
          );
          doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).stroke();
          doc.text(name, MARGIN + 6, y + 4, { width: svcColW });
          doc.text(compName, MARGIN + 6 + svcColW, y + 4, { width: compColW });
          doc.text(String(cot), MARGIN + 6 + svcColW + compColW, y + 4, { width: 56 });
          doc.text(String(ejec), MARGIN + 6 + svcColW + compColW + 56, y + 4);
          y += rowH;
        });
      });
      y += 16;
    }

    if (order.description) {
      const descHeight = 50;
      y = ensureSpace(doc, reportDate, y, descHeight);
      doc.font('Helvetica-Bold').text('Observaciones', MARGIN, y);
      y += 12;
      doc.font('Helvetica').text(order.description, MARGIN, y, { width: CONTENT_WIDTH });
      y += 30;
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

    if (showHousingMetrology) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('METROLOGÍA DE ALOJAMIENTOS', MARGIN, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').text(`Equipo: ${order.serial_number || '-'}  |  N° Orden Cliente: ${order.client_service_order_number || '-'}`, MARGIN, y);
    y += 20;

    const housings = serviceHousings.length ? serviceHousings : [];
    const byId = (id) => housings.find((h) => h.id === id) || {};

    const nomSvcW = 100;
    const nomCompW = 88;
    const nomMedW = 34;
    const nomNomW = 48;
    const nomTolW = 48;
    const nomUnitW = 30;
    const nomDescW =
      CONTENT_WIDTH - nomSvcW - nomCompW - nomMedW - nomNomW - nomTolW - nomUnitW;
    const nomX = {
      svc: MARGIN,
      comp: MARGIN + nomSvcW,
      med: MARGIN + nomSvcW + nomCompW,
      desc: MARGIN + nomSvcW + nomCompW + nomMedW,
      nom: MARGIN + nomSvcW + nomCompW + nomMedW + nomDescW,
      tol: MARGIN + nomSvcW + nomCompW + nomMedW + nomDescW + nomNomW,
      unit: MARGIN + nomSvcW + nomCompW + nomMedW + nomDescW + nomNomW + nomTolW,
    };

    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('MEDIDAS NOMINALES', MARGIN, y);
    y += 14;
    if (housings.length === 0) {
      doc.font('Helvetica').text('Sin alojamientos definidos.', MARGIN, y);
      y += 20;
    } else {
      let hasAnyNominalRow = false;
      services.forEach((svc) => {
        const svcName = [svc.service_code, svc.service_name].filter(Boolean).join(' — ') || 'Servicio';
        const comps = serviceComponentsList(svc);
        comps.forEach((comp) => {
          const compHousings = (comp.housings || []).length
            ? comp.housings
            : housings.filter((h) => housingBelongsToComponent(h, comp));
          if (compHousings.length === 0) return;
          hasAnyNominalRow = true;
          const sectionTitle = `${svcName} — ${comp.component_name || 'Componente'}`;
          const titleH = doc.heightOfString(sectionTitle, { width: CONTENT_WIDTH }) + 8;
          y = ensureSpace(doc, reportDate, y, titleH + 40);
          doc.font('Helvetica-Bold').fontSize(9).text(sectionTitle, MARGIN, y);
          y += titleH;
          doc.font('Helvetica').fontSize(8);
          doc.text('Servicio', nomX.svc, y, { width: nomSvcW });
          doc.text('Componente', nomX.comp, y, { width: nomCompW });
          doc.text('Medida', nomX.med, y, { width: nomMedW });
          doc.text('Descripción', nomX.desc, y, { width: nomDescW });
          doc.text('Nominal', nomX.nom, y, { width: nomNomW });
          doc.text('Tolerancia', nomX.tol, y, { width: nomTolW });
          doc.text('Unidad', nomX.unit, y, { width: nomUnitW });
          y += 12;
          doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
          y += 6;
          compHousings.forEach((h, rowIdx) => {
            const descStr = h.description || '-';
            const nom = h.nominal_value != null ? String(h.nominal_value) : '-';
            const tol = h.tolerance || '-';
            const unit = h.nominal_unit || '-';
            const rowH = measurementRowHeight(doc, [
              { text: svcName, width: nomSvcW },
              { text: h.component_name || comp.component_name || '-', width: nomCompW },
              { text: h.measure_code || '-', width: nomMedW },
              { text: descStr, width: nomDescW },
              { text: nom, width: nomNomW },
              { text: tol, width: nomTolW },
              { text: unit, width: nomUnitW },
            ]);
            if (rowIdx > 0) {
              y = ensureSpace(doc, reportDate, y, rowH);
            }
            doc.text(svcName, nomX.svc, y, { width: nomSvcW });
            doc.text(h.component_name || comp.component_name || '-', nomX.comp, y, { width: nomCompW });
            doc.text(h.measure_code || '-', nomX.med, y, { width: nomMedW });
            doc.text(descStr, nomX.desc, y, { width: nomDescW });
            doc.text(nom, nomX.nom, y, { width: nomNomW });
            doc.text(tol, nomX.tol, y, { width: nomTolW });
            doc.text(unit, nomX.unit, y, { width: nomUnitW });
            y += rowH;
          });
          y += 10;
        });
      });
      if (!hasAnyNominalRow) {
        doc.font('Helvetica').text('Sin alojamientos definidos por componente.', MARGIN, y);
        y += 20;
      } else {
        y += 6;
      }
    }

    const { MET_COL, metX } = buildMetrologyColumns();

    {
      const titleH = 14;
      const needBeforeTitle =
        initialMeasurements.length === 0
          ? titleH + 20
          : titleH + spaceForMeasurementTableStart(doc, initialMeasurements[0], byId, MET_COL, services);
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
          y = ensureSpace(doc, reportDate, y, spaceForMeasurementTableStart(doc, m, byId, MET_COL, services));
        }
        doc.font('Helvetica').fontSize(9).fillColor('black').text(`Fecha: ${formatDateTime(m.measurement_date)}`, MARGIN, y);
        y += 12;
        if (hmList.length > 0) {
          drawMeasurementTableHeaders(doc, metX, MET_COL, y);
          y += 14;
          doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
          y += 8;
          hmList.forEach((hm, rowIdx) => {
            const rowH = measurementTableRowHeight(doc, hm, byId, MET_COL, services);
            if (rowIdx > 0) {
              y = ensureSpace(doc, reportDate, y, rowH);
            }
            drawMeasurementTableRow(doc, hm, byId, MET_COL, metX, y, services);
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
          : titleH + spaceForMeasurementTableStart(doc, finalMeasurements[0], byId, MET_COL, services);
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
          y = ensureSpace(doc, reportDate, y, spaceForMeasurementTableStart(doc, m, byId, MET_COL, services));
        }
        doc.font('Helvetica').fontSize(9).fillColor('black').text(`Fecha: ${formatDateTime(m.measurement_date)}`, MARGIN, y);
        y += 12;
        if (hmList.length > 0) {
          drawMeasurementTableHeaders(doc, metX, MET_COL, y);
          y += 14;
          doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
          y += 8;
          hmList.forEach((hm, rowIdx) => {
            const rowH = measurementTableRowHeight(doc, hm, byId, MET_COL, services);
            if (rowIdx > 0) {
              y = ensureSpace(doc, reportDate, y, rowH);
            }
            drawMeasurementTableRow(doc, hm, byId, MET_COL, metX, y, services);
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

    }

    // Firmas Capataz y Superintendente (después de medidas finales): títulos siempre; imagen/datos solo si existen
    const conformityCapataz = order.conformity_signature_capataz || null;
    const conformitySuperintendente = order.conformity_signature_superintendente || null;
    const supFilePath = getSuperintendentSignatureFilePath(order);
    const hasSupFile = supFilePath && fs.existsSync(supFilePath);
    const supLegacyBuf = conformitySuperintendente?.signature_data
      ? signatureDataToBuffer(conformitySuperintendente.signature_data)
      : null;

    /** Separación antes/después del bloque capataz y antes del superintendente (~20 mm; firma manual en impreso). */
    const MANUAL_SIGNATURE_GAP_PT = 56;
    const signatureBlockHeight2 = 220;
    y = ensureSpace(doc, reportDate, y, signatureBlockHeight2 + MANUAL_SIGNATURE_GAP_PT);
    y += MANUAL_SIGNATURE_GAP_PT;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Firma del Capataz que recibe el trabajo', MARGIN, y);
    y += 18;
    if (conformityCapataz && conformityCapataz.signature_data) {
      const sigBufCap = signatureDataToBuffer(conformityCapataz.signature_data);
      if (sigBufCap) {
        try {
          doc.image(sigBufCap, MARGIN, y, { width: 180, height: 60, fit: [180, 60] });
          y += 62;
        } catch (_) {
          /* sin texto placeholder */
        }
      }
      doc.font('Helvetica').fontSize(10).fillColor('black');
      doc.text(`Nombre: ${conformityCapataz.signed_by_name || '-'}`, MARGIN, y);
      y += 14;
      doc.text(`Fecha: ${formatDateTime(conformityCapataz.signed_at)}`, MARGIN, y);
      y += 22;
    } else {
      y += 6;
    }

    y += MANUAL_SIGNATURE_GAP_PT;

    y = ensureSpace(doc, reportDate, y, signatureBlockHeight2);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Firma del Superintendente', MARGIN, y);
    y += 18;
    if (hasSupFile) {
      try {
        doc.image(supFilePath, MARGIN, y, { width: 180, height: 60, fit: [180, 60] });
        y += 62;
      } catch (_) {
        /* sin texto placeholder */
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
        /* sin texto placeholder */
      }
      doc.font('Helvetica').fontSize(10).fillColor('black');
      doc.text(`Nombre: ${conformitySuperintendente?.signed_by_name || '-'}`, MARGIN, y);
      y += 14;
      doc.text(`Fecha: ${formatDateTime(conformitySuperintendente?.signed_at)}`, MARGIN, y);
      y += 22;
    } else {
      y += 6;
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

    doc.addPage();
    y = CONTENT_TOP + TITLE_MARGIN_BELOW_HEADER;
    drawHeader(doc, reportDate);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Anexos Fotográficos', MARGIN, y);
    y += 20;

    if (photosForAnnex.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#555').text('No hay fotos adjuntas para esta orden de trabajo.', MARGIN, y);
      y += 20;
    } else {
      const photoGroups = buildPhotoAnnexGroups(photosForAnnex, services);
      for (const g of photoGroups) {
        const titleH = doc.heightOfString(g.title, { width: CONTENT_WIDTH });
        y = ensureSpace(doc, reportDate, y, titleH + 12);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(g.title, MARGIN, y, { width: CONTENT_WIDTH });
        y += titleH + 10;

        const rows = [];
        for (let i = 0; i < g.photos.length; i += PHOTOS_PER_ROW) {
          rows.push(g.photos.slice(i, i + PHOTOS_PER_ROW));
        }
        rows.forEach((rowPhotos) => {
          const buildCaption = (photo) => {
            const typeLabel = photoTypes[photo.photo_type] || photo.photo_type || 'Foto';
            const desc = (photo.description || '').trim();
            return desc ? `${typeLabel}: ${desc}` : typeLabel;
          };
          const captions = rowPhotos.map(buildCaption);
          doc.font('Helvetica').fontSize(8).fillColor('#333');
          let maxCapH = doc.currentLineHeight();
          for (const c of captions) {
            const h = doc.heightOfString(c, { width: photoCellW, align: 'center' });
            maxCapH = Math.max(maxCapH, h);
          }
          const capGap = 6;
          const afterCapGap = 8;
          const rowBlockH = photoCellH + capGap + maxCapH + afterCapGap;
          y = ensureSpace(doc, reportDate, y, rowBlockH);
          const imageY = y;
          rowPhotos.forEach((photo, colIndex) => {
            const absPath = getPhotoFilePath(photo);
            const x = MARGIN + colIndex * (photoCellW + photoGap);
            if (absPath && fs.existsSync(absPath)) {
              try {
                doc.image(absPath, x, imageY, { fit: [photoCellW, photoCellH], align: 'center', valign: 'top' });
              } catch (_) {
                doc.font('Helvetica').fontSize(7).fillColor('#888').text('(Error)', x, imageY + photoCellH / 2 - 4, { width: photoCellW, align: 'center' });
              }
            } else {
              doc.font('Helvetica').fontSize(7).fillColor('#888').text('(No encontrada)', x, imageY + photoCellH / 2 - 4, { width: photoCellW, align: 'center' });
            }
          });
          const capY = imageY + photoCellH + capGap;
          doc.font('Helvetica').fontSize(8).fillColor('#333');
          rowPhotos.forEach((photo, colIndex) => {
            const x = MARGIN + colIndex * (photoCellW + photoGap);
            doc.text(captions[colIndex], x, capY, { width: photoCellW, align: 'center' });
          });
          y = capY + maxCapH + afterCapGap;
        });
        y += 4;
      }
    }

    drawFooter(doc);
    doc.end();
  });

  return appendBlueprintPdfPages(pdfBuffer, pdfPlanosForMerge);
}
