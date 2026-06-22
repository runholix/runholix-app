import RequiredMarker from "./RequiredMarker.jsx";

export default function Field({ label, children, hint, required=false }) {
    return (
        <div className="form-group">
            <label className="form-label">{label}<RequiredMarker isRequired={required} /></label>
            {children}
            {hint && <span style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 2 }}>{hint}</span>}
        </div>
    );
}