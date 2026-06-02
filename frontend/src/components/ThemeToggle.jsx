import { useTheme } from '../hooks/useTheme.jsx';

const OPTIONS = [
  { value: 'light',  icon: 'ti-sun',          label: 'Light'  },
  { value: 'system', icon: 'ti-device-laptop', label: 'System' },
  { value: 'dark',   icon: 'ti-moon',          label: 'Dark'   },
];

export default function ThemeToggle({ compact = false }) {
  const { preference, setTheme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: 2,
      gap: 2,
      width: '100%',       /* fill whatever container it's in */
    }}>
      {OPTIONS.map(opt => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            aria-label={opt.label}
            style={{
              flex: 1,           /* equal thirds — prevents overflow */
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: compact ? 0 : 4,
              padding: '5px 4px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'var(--color-surface)' : 'transparent',
              color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: active ? 600 : 400,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <i className={`ti ${opt.icon}`} style={{ fontSize: 14, flexShrink: 0 }} />
            {!compact && (
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 36,   /* clamp label before it causes overflow */
              }}>
                {opt.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
