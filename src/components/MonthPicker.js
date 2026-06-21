import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * value:    'YYYY-MM' string (or '' for no selection)
 * onChange: called with 'YYYY-MM' or ''
 * minYear / maxYear: optional clamps (numbers)
 * style: extra style on the trigger button
 */
export default function MonthPicker({ value, onChange, minYear, maxYear, style = {} }) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() =>
    value ? parseInt(value.slice(0, 4)) : new Date().getFullYear()
  );
  const ref = useRef();

  // Keep pickerYear in sync when value changes externally
  useEffect(() => {
    if (value) setPickerYear(parseInt(value.slice(0, 4)));
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selYear = value ? parseInt(value.slice(0, 4)) : null;
  const selMonthIdx = value ? parseInt(value.slice(5, 7)) - 1 : null;

  const displayLabel = value
    ? new Date(value + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Select month';

  const canGoPrev = !minYear || pickerYear > minYear;
  const canGoNext = !maxYear || pickerYear < maxYear;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: '0.85rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          ...style,
        }}
      >
        <CalendarDays size={14} style={{ flexShrink: 0 }} />
        {displayLabel}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 200,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '12px',
          minWidth: 224,
          boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
        }}>
          {/* Year navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <button
              type="button"
              onClick={() => canGoPrev && setPickerYear(y => y - 1)}
              style={{
                background: 'none',
                border: 'none',
                color: canGoPrev ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: canGoPrev ? 'pointer' : 'default',
                padding: '2px 6px',
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {pickerYear}
            </span>
            <button
              type="button"
              onClick={() => canGoNext && setPickerYear(y => y + 1)}
              style={{
                background: 'none',
                border: 'none',
                color: canGoNext ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: canGoNext ? 'pointer' : 'default',
                padding: '2px 6px',
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {MONTHS.map((m, i) => {
              const monthKey = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
              const isSelected = selYear === pickerYear && selMonthIdx === i;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onChange(monthKey); setOpen(false); }}
                  style={{
                    padding: '7px 4px',
                    background: isSelected ? 'var(--plum-medium, #7c3aed)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    border: `1px solid ${isSelected ? 'var(--plum-medium, #7c3aed)' : 'var(--border-color)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontFamily: 'inherit',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'background 0.15s',
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid var(--border-color)',
          }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit', padding: '2px 4px',
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 7);
                onChange(today);
                setOpen(false);
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--plum-glow, #a855f7)',
                cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
                padding: '2px 4px', fontWeight: 600,
              }}
            >
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
