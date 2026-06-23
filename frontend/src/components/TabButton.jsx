export default function TabButton({ active, onClick, children, hidden = false, icon }) {
    if (hidden) return null;
    return (
        <button
            type="button"
            onClick={onClick}
            className="btn btn-secondary"
            style={{
                justifyContent: 'center',
                borderColor: active ? 'var(--color-primary)' : undefined,
                background: active ? 'var(--color-primary-bg)' : undefined,
                color: active ? 'var(--color-primary)' : undefined,
            }}
        >
            {icon && <i className={`ti ${icon}`} style={{ fontSize: 16, marginLeft: '-5px' }} />}
            {children}
        </button>
    );
}
