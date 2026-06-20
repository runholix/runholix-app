import { EVENT_COLORS, eventIcon } from "./CalendarPage.jsx";

export default function EventChip({ event, onEventClick }) {
    const c = EVENT_COLORS[event.type];
    return (
        <span
            onClick={e => { e.stopPropagation(); onEventClick(event, e); }}
            title={event.label + (event.time ? ` · ${event.time}` : '')}
            style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
                borderRadius: 4,
                padding: '1px 5px',
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                cursor: 'pointer',
                marginBottom: 2,
                display: 'block',
            }}
        >
      {eventIcon(event.type)}{' '}
            {event.label}
    </span>
    );
}