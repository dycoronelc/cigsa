import { useEffect, useMemo, useRef, useState } from 'react';
import './SearchableSelect.css';

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Buscar...',
  disabled = false,
  allowClear = false,
  clearLabel = '— Ninguno —',
  id
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => {
    return (options || []).find((o) => String(o.value) === String(value)) || null;
  }, [options, value]);

  useEffect(() => {
    // Keep input showing current selection when not actively searching
    if (!open) {
      setQuery(selected?.label || '');
    }
  }, [open, selected]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    const base = options || [];
    if (!open) return base;
    if (!q) return base;
    return base.filter((o) => String(o.label || '').toLowerCase().includes(q));
  }, [options, open, query]);

  const pick = (val, label) => {
    onChange?.(val);
    setOpen(false);
    setQuery(label || '');
  };

  return (
    <div ref={containerRef} className={`searchable-select ${disabled ? 'is-disabled' : ''}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={open ? query : (selected?.label || query)}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          // When opening, start searching from current text
          requestAnimationFrame(() => inputRef.current?.select?.());
        }}
        onClick={() => !disabled && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />

      <button
        type="button"
        className="searchable-select-chevron"
        aria-label="Abrir"
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          requestAnimationFrame(() => inputRef.current?.focus?.());
        }}
        disabled={disabled}
      >
        ▾
      </button>

      {open && !disabled && (
        <div className="searchable-select-menu" role="listbox">
          {allowClear && (
            <button
              type="button"
              className="searchable-select-item clear"
              onClick={() => pick('', '')}
            >
              {clearLabel}
            </button>
          )}

          {filtered.length > 0 ? (
            filtered.map((o) => (
              <button
                type="button"
                key={String(o.value)}
                className={`searchable-select-item ${String(o.value) === String(value) ? 'selected' : ''}`}
                onClick={() => pick(String(o.value), o.label)}
              >
                {o.label}
              </button>
            ))
          ) : (
            <div className="searchable-select-empty">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

