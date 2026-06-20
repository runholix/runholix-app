export default function CalendarPagination({ navPrev, navNext, title }) {
    return (
        <>
            <button onClick={navPrev} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px', flexShrink: 0 }}>
                <i className="ti ti-chevron-left" />
            </button>
            <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title()}</span>
            <button onClick={navNext} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px', flexShrink: 0 }}>
                <i className="ti ti-chevron-right" />
            </button>
        </>
    )
}