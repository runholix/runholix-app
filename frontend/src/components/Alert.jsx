export default function Alert({ type, message }) {
    if (!message) return null;
    const styles = {
        success: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', icon: 'ti-circle-check' },
        error:   { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  icon: 'ti-circle-x'    },
        info:    { bg: 'var(--color-primary-bg)', color: 'var(--color-primary)', icon: 'ti-info-circle'  },
    };
    const s = styles[type] || styles.info;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius)', background: s.bg, color: s.color, fontSize: 13, marginTop: 12 }}>
            <i className={`ti ${s.icon}`} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{message}</span>
        </div>
    );
}