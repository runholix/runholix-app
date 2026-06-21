import { useEffect, useMemo, useState } from 'react';

const TIMEZONES = Intl.supportedValuesOf('timeZone')?.map((tz) => {
    try {
        // Format the current time to extract the numeric offset component
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'longOffset'
        }).formatToParts(new Date());

        const offsetPart = parts.find(p => p.type === 'timeZoneName');
        const offset = offsetPart ? offsetPart.value : 'GMT+00:00';

        return { tz, offset };
    } catch (e) {
        return { tz, offset: 'Error' };
    }
});

export default function TimezoneSelect({
  timezone,
  setTimezone,
  onFilteredChange,
  onTimezoneExistChange,
  label=undefined
}) {
  const [search, setSearch] = useState(timezone || 'UTC');
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TIMEZONES;
    return TIMEZONES.filter(tz => tz?.tz?.toLowerCase().includes(q));
  }, [search]);

  const timezoneExist = useMemo(() => TIMEZONES.some((tz) => tz?.tz === timezone), [timezone]);

  useEffect(() => {
    setSearch(timezone);
  }, [timezone]);

  useEffect(() => {
    onFilteredChange?.(filtered);
  }, [filtered, onFilteredChange]);

  useEffect(() => {
    onTimezoneExistChange?.(timezoneExist);
  }, [timezoneExist, onTimezoneExistChange]);

  const selectTimezone = (tz) => {
    setTimezone(tz);
    setShowDropdown(false);
  };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="form-label">{label || "Timezone"}</label>
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
                  key={tz?.tz}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectTimezone(tz?.tz)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    background: timezone === tz?.tz ? 'var(--color-primary-bg)' : '',
                    color: timezone === tz?.tz ? 'var(--color-primary)' : '',
                  }}
                  onMouseEnter={e => {
                if (timezone !== tz?.tz) e.currentTarget.style.background = 'var(--color-bg)';
              }}
              onMouseLeave={e => {
                if (timezone !== tz?.tz) e.currentTarget.style.background = '';
              }}
            >
                <div style={{ fontWeight: 500 }}>{tz.tz}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{tz.offset}</div>
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
