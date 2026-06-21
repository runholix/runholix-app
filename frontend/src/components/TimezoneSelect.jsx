import { useEffect, useMemo, useState } from 'react';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export default function TimezoneSelect({
  timezone,
  setTimezone,
  onFilteredChange,
  onTimezoneExistChange,
}) {
  const [search, setSearch] = useState(timezone || 'UTC');
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TIMEZONES;
    return TIMEZONES.filter(tz => tz.toLowerCase().includes(q));
  }, [search]);

  const timezoneExist = useMemo(() => TIMEZONES.includes(timezone), [timezone]);

  useEffect(() => {
    onFilteredChange?.(filtered);
  }, [filtered, onFilteredChange]);

  useEffect(() => {
    onTimezoneExistChange?.(timezoneExist);
  }, [timezoneExist, onTimezoneExistChange]);

  const selectTimezone = (tz) => {
    setTimezone(tz);
    setSearch(tz);
    setShowDropdown(false);
  };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="form-label">Default timezone</label>
      <input
        value={search}
        onFocus={() => setShowDropdown(true)}
        onChange={e => {
          setSearch(e.target.value);
          setTimezone(e.target.value);
          setShowDropdown(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setShowDropdown(false), 150);
        }}
        placeholder="Search timezones..."
        autoComplete="off"
      />

      {search && filtered.length > 0 && showDropdown && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 6,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--color-surface)',
            zIndex: 20,
          }}
        >
          {filtered.slice(0, 40).map(tz => (
            <div
              key={tz}
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectTimezone(tz)}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                cursor: 'pointer',
                background: timezone === tz ? 'var(--color-primary-bg)' : '',
                color: timezone === tz ? 'var(--color-primary)' : '',
              }}
              onMouseEnter={e => {
                if (timezone !== tz) e.currentTarget.style.background = 'var(--color-bg)';
              }}
              onMouseLeave={e => {
                if (timezone !== tz) e.currentTarget.style.background = '';
              }}
            >
              {tz}
            </div>
          ))}
        </div>
      )}

      {search && filtered.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 6 }}>No timezones found.</div>
      )}
    </div>
  );
}
