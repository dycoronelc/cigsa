/**
 * Genera el PDF del reporte de OT con encabezado y pie en todas las páginas.
 * Recibe el objeto completo de la OT (como GET /work-orders/:id).
 */
import PDFDocument from 'pdfkit';
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

function getReportDate(order) {
  const d = order.scheduled_date || order.created_at || new Date();
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return { day: '-', month: '-', year: '-' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear())
  };
}

/** Dibuja el pie de página con datos de contacto (en la página actual, al final). */
function drawFooter(doc) {
  const y = PAGE_HEIGHT - FOOTER_HEIGHT;
  doc.strokeColor('#ccc').lineWidth(0.5).moveTo(MARGIN, y - 6).lineTo(PAGE_WIDTH - MARGIN, y - 6).stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#555');
  doc.text(FOOTER_TEXT, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
}

/**
 * Si no hay espacio suficiente, dibuja el pie, añade página y encabezado. Devuelve la y para seguir.
 */
function ensureSpace(doc, reportDate, currentY, neededHeight) {
  if (currentY + neededHeight <= CONTENT_BOTTOM) return currentY;
  drawFooter(doc);
  doc.addPage();
  drawHeader(doc, reportDate);
  return CONTENT_TOP + TITLE_MARGIN_BELOW_HEADER;
}

export async function generateWorkOrderReport(orderData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const order = orderData;
    const services = order.services || [];
    const serviceHousings = order.service_housings || [];
    const measurements = order.measurements || [];
    const initialMeasurements = measurements.filter((m) => (m.measurement_type || m.measurementType || '').toLowerCase() === 'initial');
    const finalMeasurements = measurements.filter((m) => (m.measurement_type || m.measurementType || '').toLowerCase() === 'final');
    const photos = order.photos || [];
    const documents = order.documents || [];
    const reportDate = getReportDate(order);

    let y = CONTENT_TOP;

    // ----- PÁGINA 1 -----
    drawHeader(doc, reportDate);

    y += TITLE_MARGIN_BELOW_HEADER;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('black').text('REPORTE DE ORDEN DE TRABAJO', MARGIN, y);
    y += 22;

    doc.font('Helvetica').fontSize(10);
    doc.text(`Fecha: ${formatDate(order.scheduled_date || order.created_at)}`, MARGIN, y);
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
      const ejec = (svc.housings && svc.housings.length) || 0;
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

    const fotosPlanosHeight = 80;
    y = ensureSpace(doc, reportDate, y, fotosPlanosHeight);

    doc.font('Helvetica-Bold').text('Fotos', MARGIN, y);
    y += 12;
    doc.font('Helvetica').text(photos.length > 0 ? `${photos.length} foto(s) registrada(s) en el sistema.` : 'Sin fotos registradas.', MARGIN, y);
    y += 20;

    const blueprints = documents.filter((d) => d.document_type === 'blueprint' || (d.file_name && /\.(pdf|png|jpg|jpeg)$/i.test(d.file_name)));
    if (blueprints.length > 0) {
      const planosHeight = 20 + Math.min(blueprints.length, 5) * 14 + 20;
      y = ensureSpace(doc, reportDate, y, planosHeight);
      doc.font('Helvetica-Bold').text('Planos / Documentos', MARGIN, y);
      y += 12;
      doc.font('Helvetica');
      blueprints.slice(0, 5).forEach((d) => {
        doc.text(`• ${d.file_name || 'Documento'}`, MARGIN + 10, y);
        y += 14;
      });
      if (blueprints.length > 5) doc.text(`... y ${blueprints.length - 5} más`, MARGIN + 10, y);
      y += 16;
    }

    if (order.description) {
      doc.font('Helvetica-Bold').text('Observaciones', MARGIN, y);
      y += 12;
      doc.font('Helvetica').text(order.description, MARGIN, y, { width: CONTENT_WIDTH });
      y += 30;
    }

    drawFooter(doc);
    doc.addPage();
    y = CONTENT_TOP;

    // ----- PÁGINA 2: METROLOGÍA -----
    drawHeader(doc, reportDate);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('METROLOGÍA DE ALOJAMIENTOS', MARGIN, y);
    y += 10;
    doc.fontSize(10).font('Helvetica').text(`Equipo: ${order.serial_number || '-'}  |  N° Orden Cliente: ${order.client_service_order_number || '-'}`, MARGIN, y);
    y += 20;

    const housings = serviceHousings.length ? serviceHousings : [];
    const byId = (id) => housings.find((h) => h.id === id) || {};

    doc.font('Helvetica-Bold').fontSize(10).text('MEDIDAS NOMINALES', MARGIN, y);
    y += 14;
    if (housings.length === 0) {
      doc.font('Helvetica').text('Sin alojamientos definidos.', MARGIN, y);
      y += 20;
    } else {
      doc.font('Helvetica').fontSize(9);
      const colW = 70;
      doc.text('Medida', MARGIN, y);
      doc.text('Descripción', MARGIN + colW, y);
      doc.text('Nominal', MARGIN + colW + 120, y);
      doc.text('Tolerancia', MARGIN + colW + 120 + colW, y);
      doc.text('Unidad', MARGIN + colW + 120 + colW * 2, y);
      y += 14;
      doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
      y += 8;
      housings.forEach((h) => {
        const nom = h.nominal_value != null ? String(h.nominal_value) : '-';
        const tol = h.tolerance || '-';
        const unit = h.nominal_unit || '-';
        doc.text(h.measure_code || '-', MARGIN, y);
        doc.text((h.description || '-').slice(0, 25), MARGIN + colW, y, { width: 120 });
        doc.text(nom, MARGIN + colW + 120, y);
        doc.text(tol, MARGIN + colW + 120 + colW, y);
        doc.text(unit, MARGIN + colW + 120 + colW * 2, y);
        y += 14;
      });
      y += 16;
    }

    doc.font('Helvetica-Bold').fontSize(10).text('MEDIDAS INICIALES', MARGIN, y);
    y += 14;
    if (initialMeasurements.length === 0) {
      doc.font('Helvetica').text('Sin mediciones iniciales registradas.', MARGIN, y);
      y += 20;
    } else {
      initialMeasurements.forEach((m) => {
        doc.font('Helvetica').fontSize(9).text(`Fecha: ${formatDateTime(m.measurement_date)}`, MARGIN, y);
        y += 12;
        const hmList = m.housing_measurements || m.housingMeasurements || [];
        if (hmList.length === 0) {
          doc.text('(Sin datos por alojamiento)', MARGIN + 10, y);
          y += 14;
        } else {
          hmList.forEach((hm) => {
            const h = byId(hm.housing_id);
            const code = hm.measure_code || h.measure_code || '-';
            doc.text(`${code}:  X1=${hm.x1 ?? '-'}  Y1=${hm.y1 ?? '-'}  Unidad=${hm.unit || '-'}`, MARGIN + 10, y);
            y += 12;
          });
        }
        y += 6;
      });
      y += 8;
    }

    doc.font('Helvetica-Bold').fontSize(10).text('MEDIDAS FINALES', MARGIN, y);
    y += 14;
    if (finalMeasurements.length === 0) {
      doc.font('Helvetica').text('Sin mediciones finales registradas.', MARGIN, y);
      y += 20;
    } else {
      finalMeasurements.forEach((m) => {
        doc.font('Helvetica').fontSize(9).text(`Fecha: ${formatDateTime(m.measurement_date)}`, MARGIN, y);
        y += 12;
        const hmList = m.housing_measurements || m.housingMeasurements || [];
        if (hmList.length === 0) {
          doc.text('(Sin datos por alojamiento)', MARGIN + 10, y);
          y += 14;
        } else {
          hmList.forEach((hm) => {
            const h = byId(hm.housing_id);
            const code = hm.measure_code || h.measure_code || '-';
            doc.text(`${code}:  X1=${hm.x1 ?? '-'}  Y1=${hm.y1 ?? '-'}  Unidad=${hm.unit || '-'}`, MARGIN + 10, y);
            y += 12;
          });
        }
        y += 6;
      });
    }

    doc.font('Helvetica').fontSize(8).fillColor('#555');
    doc.text(`Reporte OT: ${order.order_number || order.id} - ${formatDate(order.created_at)}`, MARGIN, y + 10);

    drawFooter(doc);
    doc.end();
  });
}
