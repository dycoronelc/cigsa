import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/pages/admin/WorkOrderDetail.jsx');
let c = fs.readFileSync(filePath, 'utf8');

const marker = "borderTop: '1px dashed #e8e6ef' }}>";
const start = c.indexOf(marker);
if (start < 0) {
  console.error('Marker not found');
  process.exit(1);
}
const sectionStart = c.lastIndexOf('<div', start);
const sectionEnd = c.indexOf('                          ))}', start);
if (sectionEnd < 0) {
  console.error('Map end not found');
  process.exit(1);
}
const closingDiv = c.indexOf('</div>', sectionEnd);
const end = closingDiv + 6;

const block = `                        <WorkOrderServiceComponentsEditor
                          components={os.components || []}
                          componentsCatalog={componentsCatalog}
                          needsOrderHousings={needsOrderHousings}
                          generalComponentId={generalComponentId}
                          createDefaultComponent={createDefaultComponent}
                          onUpdateComponent={(ci, field, value) => updateServiceComponent(idx, ci, field, value)}
                          onAddComponent={() => addComponentToService(idx)}
                          onRemoveComponent={(ci) => removeComponentFromService(idx, ci)}
                          onOpenHousingsModal={(ci) => openHousingsModalForComponent(idx, ci)}
                        />`;

c = c.slice(0, sectionStart) + block + c.slice(end);
fs.writeFileSync(filePath, c);
console.log('Fixed', filePath);
