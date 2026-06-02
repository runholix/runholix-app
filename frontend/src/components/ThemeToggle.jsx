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
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 0 : 5,
              padding: compact ? '5px 8px' : '5px 10px',
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
            }}
          >
            <i className={`ti ${opt.icon}`} style={{ fontSize: 14 }} />
            {!compact && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
