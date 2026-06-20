export default function ViewSwitcher({ view, setView }) {
    const VIEWS = ['yearly', 'monthly', 'weekly', 'daily'];
    const VIEW_LABELS = { yearly: 'Year', monthly: 'Month', weekly: 'Week', daily: 'Day' };

    return (
        <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 2, gap: 2, flexShrink: 0 }}>
            {VIEWS.map(v => (
                <button
                    key={v}
                    onClick={() => setView(v)}
                    style={{
                        padding: '5px 8px',
                        borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        background: view === v ? 'var(--color-surface)' : 'transparent',
                        color: view === v ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {VIEW_LABELS[v]}
                </button>
            ))}
        </div>
    );
}