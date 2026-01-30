import { useMemo, useState } from 'react';

function defaultCompare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  // Dates
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  // Numbers (or numeric strings)
  const an = typeof a === 'number' ? a : (typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a)) ? Number(a) : null);
  const bn = typeof b === 'number' ? b : (typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b)) ? Number(b) : null);
  if (an != null && bn != null) return an - bn;

  // Fallback to string compare (case-insensitive)
  const as = String(a).toLowerCase();
  const bs = String(b).toLowerCase();
  return as.localeCompare(bs, 'es');
}

export function useSortableData(items, initialConfig = null) {
  const [sortConfig, setSortConfig] = useState(initialConfig); // { key, direction, getValue }

  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    if (!sortConfig?.key) return items;

    const { direction, getValue } = sortConfig;
    const dir = direction === 'desc' ? -1 : 1;

    return [...items].sort((a, b) => {
      const av = getValue ? getValue(a) : a?.[sortConfig.key];
      const bv = getValue ? getValue(b) : b?.[sortConfig.key];
      return defaultCompare(av, bv) * dir;
    });
  }, [items, sortConfig]);

  const requestSort = (key, getValue) => {
    setSortConfig((prev) => {
      const isSame = prev?.key === key;
      const nextDir = isSame && prev?.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction: nextDir, getValue };
    });
  };

  const getSortDirection = (key) => (sortConfig?.key === key ? sortConfig.direction : null);

  return { items: sortedItems, requestSort, sortConfig, getSortDirection };
}

