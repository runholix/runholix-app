import { EVENT_COLORS } from "./CalendarPage.jsx";

export default function Legend() {
    return (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
                { type: 'race',     label: 'Race' },
                { type: 'registration', label: 'Registration' },
                { type: 'rpc',      label: 'Race Pack' },
                { type: 'training', label: 'Training' },
            ].map(({ type, label }) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: EVENT_COLORS[type].border, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                </div>
            ))}
        </div>
    );
}