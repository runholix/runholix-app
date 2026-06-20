import { useState } from "react";

// ── Mandatory Items table (trail only) ────────────────────────────────────
export default function MandatoryItemsSection({ items, onChange }) {
    const [newName, setNewName] = useState('');

    const addItem = () => {
        const name = newName.trim();
        if (!name) return;
        onChange([...items, { name, mandatory: false, recommended: false }]);
        setNewName('');
    };

    const updateItem = (idx, field, value) => {
        const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
        onChange(updated);
    };

    const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));

    return (
        <>
            <div className="form-section-title">Mandatory Items</div>
            <div style={{ border:'1px solid var(--color-border)', borderRadius:'var(--radius)', overflow:'hidden', marginBottom:12 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:0 }}>
                    <thead>
                    <tr style={{ background:'var(--color-bg)' }}>
                        <th style={{ padding:'8px 12px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--color-text-muted)', borderBottom:'1px solid var(--color-border)' }}>Gear name</th>
                        <th style={{ padding:'8px 12px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--color-text-muted)', borderBottom:'1px solid var(--color-border)', width:100 }}>Mandatory</th>
                        <th style={{ padding:'8px 12px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--color-text-muted)', borderBottom:'1px solid var(--color-border)', width:110 }}>Recommended</th>
                        <th style={{ padding:'8px 12px', borderBottom:'1px solid var(--color-border)', width:40 }}></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 && (
                        <tr><td colSpan={4} style={{ padding:'16px 12px', textAlign:'center', color:'var(--color-text-hint)', fontSize:13 }}>No items yet. Add one below.</td></tr>
                    )}
                    {items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom:'1px solid var(--color-border)' }}>
                            <td style={{ padding:'8px 12px' }}>
                                <input
                                    value={item.name}
                                    onChange={e => updateItem(idx, 'name', e.target.value)}
                                    style={{ border:'none', background:'transparent', padding:0, fontSize:13, width:'100%', color:'var(--color-text)' }}
                                    placeholder="e.g. Headlamp"
                                />
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'center' }}>
                                <input type="checkbox" checked={item.mandatory} onChange={e => {
                                    const checked = e.target.checked;
                                    const updated = items.map((it, i) => i === idx
                                        ? { ...it, mandatory: checked, recommended: checked ? false : it.recommended }
                                        : it);
                                    onChange(updated);
                                }} style={{ width:16, height:16, accentColor:'var(--color-danger)', cursor:'pointer' }} />
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'center' }}>
                                <input type="checkbox" checked={item.recommended} onChange={e => {
                                    const checked = e.target.checked;
                                    const updated = items.map((it, i) => i === idx
                                        ? { ...it, recommended: checked, mandatory: checked ? false : it.mandatory }
                                        : it);
                                    onChange(updated);
                                }} style={{ width:16, height:16, accentColor:'var(--color-warning)', cursor:'pointer' }} />
                            </td>
                            <td style={{ padding:'8px 12px' }}>
                                <button type="button" onClick={() => removeItem(idx)} className="btn btn-ghost btn-sm" style={{ padding:'2px 6px' }}>
                                    <i className="ti ti-trash" style={{ fontSize:13, color:'var(--color-danger)' }} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                    placeholder="Gear name (e.g. Headlamp, Whistle…)"
                    style={{ flex:1 }}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                    <i className="ti ti-plus" /> Add item
                </button>
            </div>
        </>
    );
}