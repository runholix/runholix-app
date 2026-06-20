export default function Field({ label, children, hint }) {
    return (
        <div className="form-group">
            <label className="form-label">{label}</label>
            {children}
            {hint && <span style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 2 }}>{hint}</span>}
        </div>
    );
}