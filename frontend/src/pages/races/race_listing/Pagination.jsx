export default function Pagination({ page, totalPages, total, pageSize, onChange }) {
    if (totalPages <= 1) return null;
    const from = (page - 1) * pageSize + 1;
    const to   = Math.min(page * pageSize, total);

    const pages = [];
    const add = n => { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n); };
    add(1); add(page - 1); add(page); add(page + 1); add(totalPages);
    pages.sort((a, b) => a - b);

    const withGaps = [];
    for (let i = 0; i < pages.length; i++) {
        if (i > 0 && pages[i] - pages[i - 1] > 1) withGaps.push('…');
        withGaps.push(pages[i]);
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Showing {from}–{to} of {total} races
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button onClick={() => onChange(page - 1)} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}>
                    {page !== 1 && <i className="ti ti-chevron-left" />}
                </button>
                {withGaps.map((p, i) =>
                    p === '…' ? (
                        <span key={`gap-${i}`} style={{ padding: '5px 4px', fontSize: 13, color: 'var(--color-text-hint)' }}>…</span>
                    ) : (
                        <button key={p} onClick={() => onChange(p)} className="btn btn-sm" style={{
                            padding: '5px 10px', minWidth: 34,
                            background: p === page ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: p === page ? '#fff' : 'var(--color-text)',
                            border: `1px solid ${p === page ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            fontWeight: p === page ? 600 : 400,
                        }}>{p}</button>
                    )
                )}
                <button onClick={() => onChange(page + 1)} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}>
                    {page !== totalPages && <i className="ti ti-chevron-right" />}
                </button>
            </div>
        </div>
    );
}