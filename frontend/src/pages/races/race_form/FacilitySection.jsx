import { useState } from "react";

const DEFAULT_FACILITIES = [
    'Finisher medal','BIB timing chip','Race jersey',
    'Finisher certificate','Finisher jersey','Finisher cap',
];

// ── Facility section ──────────────────────────────────────────────────────
export default function FacilitySection({ facilities, onChange }) {
    const [customInput, setCustomInput] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    const toggle = (name) => {
        const exists = facilities.find(f => f.name === name);
        if (exists) onChange(facilities.filter(f => f.name !== name));
        else onChange([...facilities, { name, custom: false }]);
    };
    const addCustom = () => {
        const trimmed = customInput.trim();
        if (!trimmed || facilities.find(f => f.name === trimmed)) return;
        onChange([...facilities, { name: trimmed, custom: true }]);
        setCustomInput(''); setShowCustomInput(false);
    };
    const removeCustom = (name) => onChange(facilities.filter(f => f.name !== name));
    const isChecked = (name) => !!facilities.find(f => f.name === name);
    const customItems = facilities.filter(f => f.custom);

    return (
        <>
            <div className="form-section-title">Facility</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px 16px', marginBottom:14 }}>
                {DEFAULT_FACILITIES.map(name => (
                    <label key={name} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'8px 10px', borderRadius:'var(--radius)', border:`1px solid ${isChecked(name) ? 'var(--color-primary)' : 'var(--color-border)'}`, background: isChecked(name) ? 'var(--color-primary-bg)' : 'var(--color-surface)', transition:'all 0.15s' }}>
                        <input type="checkbox" checked={isChecked(name)} onChange={() => toggle(name)} style={{ width:16, height:16, accentColor:'var(--color-primary)', flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight: isChecked(name) ? 500 : 400, color: isChecked(name) ? 'var(--color-primary)' : 'var(--color-text)' }}>{name}</span>
                    </label>
                ))}
                {customItems.map(item => (
                    <label key={item.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:'var(--radius)', border:'1px solid var(--color-primary)', background:'var(--color-primary-bg)' }}>
                        <input type="checkbox" checked={true} onChange={() => removeCustom(item.name)} style={{ width:16, height:16, accentColor:'var(--color-primary)', flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight:500, color:'var(--color-primary)', flex:1 }}>{item.name}</span>
                        <button type="button" onClick={() => removeCustom(item.name)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--color-text-muted)', lineHeight:1 }}>
                            <i className="ti ti-x" style={{ fontSize:12 }} />
                        </button>
                    </label>
                ))}
            </div>
            {showCustomInput ? (
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                    <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } if (e.key === 'Escape') setShowCustomInput(false); }}
                           placeholder="Custom facility name…" autoFocus style={{ flex:1 }} />
                    <button type="button" className="btn btn-primary btn-sm" onClick={addCustom}>Add</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowCustomInput(false); setCustomInput(''); }}>Cancel</button>
                </div>
            ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCustomInput(true)} style={{ marginBottom:8 }}>
                    <i className="ti ti-plus" /> Add custom item
                </button>
            )}
        </>
    );
}