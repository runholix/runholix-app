export default function MandatoryItemsSection({ race }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Mandatory Items</div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }}>
                    <thead>
                    <tr style={{ background: 'var(--color-bg)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                            Gear name
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', width: 100 }}>
                            Mandatory
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', width: 110 }}>
                            Recommended
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {race.mandatory_items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < race.mandatory_items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{item.name}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {item.mandatory
                                    ? <i className="ti ti-circle-check-filled" style={{ fontSize: 18, color: 'var(--color-danger)' }} />
                                    : <i className="ti ti-circle-x" style={{ fontSize: 18, color: 'var(--color-border)' }} />}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {item.recommended
                                    ? <i className="ti ti-circle-check-filled" style={{ fontSize: 18, color: 'var(--color-warning)' }} />
                                    : <i className="ti ti-circle-x" style={{ fontSize: 18, color: 'var(--color-border)' }} />}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}