import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const editorImport = `import WorkOrderServiceComponentsEditor from '../../components/WorkOrderComponentsEditor';
import '../../components/WorkOrderComponentsEditor.css';
`;

function patchFile(filePath, idxExpr) {
  let c = fs.readFileSync(filePath, 'utf8');
  const isNew = filePath.includes('WorkOrderNew');

  if (!c.includes('WorkOrderComponentsEditor')) {
    if (isNew) {
      c = c.replace(
        "} from '../../utils/workOrderComponents';\nimport './WorkOrderNew.css';",
        "} from '../../utils/workOrderComponents';\n" + editorImport + "import './WorkOrderNew.css';"
      );
    } else {
      c = c.replace(
        "} from '../../utils/workOrderComponents';\nimport './WorkOrderDetail.css';",
        "} from '../../utils/workOrderComponents';\n" + editorImport + "import './WorkOrderDetail.css';"
      );
    }
  }

  const marker = isNew
    ? "borderTop: '1px dashed #e8e6ef' }}"
    : "borderTop: '1px dashed #e8e6ef' }}";
  const start = c.indexOf(marker);
  if (start < 0) {
    console.error('Marker not found in', filePath);
    return false;
  }
  const sectionStart = c.lastIndexOf('<div', start);
  const addBtn = c.indexOf('+ Agregar componente', start);
  const sectionEnd = c.indexOf('</div>', addBtn) + 6;

  const block = `                <WorkOrderServiceComponentsEditor
                  components={os.components || []}
                  componentsCatalog={componentsCatalog}
                  needsOrderHousings={needsOrderHousings}
                  generalComponentId={generalComponentId}
                  createDefaultComponent={createDefaultComponent}
                  onUpdateComponent={(ci, field, value) => updateServiceComponent(${idxExpr}, ci, field, value)}
                  onAddComponent={() => addComponentToService(${idxExpr})}
                  onRemoveComponent={(ci) => removeComponentFromService(${idxExpr}, ci)}
                  onOpenHousingsModal={(ci) => openHousingsModalForComponent(${idxExpr}, ci)}
                />`;

  c = c.slice(0, sectionStart) + block + c.slice(sectionEnd);
  fs.writeFileSync(filePath, c);
  console.log('Patched', filePath);
  return true;
}

function patchWorkOrderDetailHelpers(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes('const addComponentToService')) return;

  const anchor = '  const openHousingsModalForComponent = (serviceIdx, componentIdx) => {';
  const helpers = `  const addComponentToService = (serviceIdx) => {
    const next = [...(editData.services || [])];
    const comps = [...(next[serviceIdx].components || []), createDefaultComponent(generalComponentId)];
    next[serviceIdx] = { ...next[serviceIdx], components: comps };
    setEditData({ ...editData, services: next });
  };

  const removeComponentFromService = (serviceIdx, componentIdx) => {
    const next = [...(editData.services || [])];
    const comps = (next[serviceIdx].components || []).filter((_, i) => i !== componentIdx);
    next[serviceIdx] = {
      ...next[serviceIdx],
      components: comps.length ? comps : [createDefaultComponent(generalComponentId)]
    };
    setEditData({ ...editData, services: next });
  };

  const updateServiceComponent = (serviceIdx, componentIdx, field, value) => {
    const next = [...(editData.services || [])];
    const comps = [...(next[serviceIdx].components || [])];
    if (!comps[componentIdx]) return;
    comps[componentIdx] = { ...comps[componentIdx], [field]: value };
    if (field === 'housingCount' && needsOrderHousings) {
      const count = Number(value) || 0;
      const existing = comps[componentIdx].housings || [];
      if (count > 0) {
        comps[componentIdx].housings = Array.from({ length: count }).map((_, i) => {
          if (existing[i]) return { ...existing[i], measureCode: existing[i].measureCode || numberToLetters(i + 1) };
          return {
            measureCode: numberToLetters(i + 1),
            description: '',
            nominalValue: '',
            nominalUnit: '',
            tolerance: ''
          };
        });
        next[serviceIdx] = { ...next[serviceIdx], components: comps };
        setEditData({ ...editData, services: next });
        setEditingServiceIdx(serviceIdx);
        setEditingComponentIdx(componentIdx);
        setShowHousingsModal(true);
        return;
      }
      comps[componentIdx].housings = [];
    }
    next[serviceIdx] = { ...next[serviceIdx], components: comps };
    setEditData({ ...editData, services: next });
  };

  `;
  c = c.replace(anchor, helpers + anchor);
  fs.writeFileSync(filePath, c);
  console.log('Added helpers to', filePath);
}

patchWorkOrderDetailHelpers(path.join(root, 'src/pages/admin/WorkOrderDetail.jsx'));
patchFile(path.join(root, 'src/pages/admin/WorkOrderNew.jsx'), 'idx');
patchFile(path.join(root, 'src/pages/admin/WorkOrderDetail.jsx'), 'idx');
