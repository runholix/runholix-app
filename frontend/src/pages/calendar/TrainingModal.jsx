import { useState } from "react";
import { api } from "../../lib/api.js";

export default function TrainingModal({ plan, races, defaultDate, onSave, onClose }) {
    const [form, setForm] = useState({
        name: plan?.name || '',
        plan_date: plan?.plan_date?.slice(0, 10) || defaultDate || '',
        plan_time: plan?.plan_time || '',
        race_id: plan?.race_id || '',
        notes: plan?.notes || '',
    });
    const [search, setSearch] = useState(() => {
        if (plan?.race_id) {
            const r = races.find(r => r.id === plan.race_id);
            return r?.event_name || '';
        }
        return '';
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);
    const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setDirty(true); };

    const confirmClose = () => {
        if (dirty && !window.confirm('You have unsaved changes. Discard and close?')) return;
        onClose();
    };

    const filteredRaces = races.filter(r =>
        r.event_name.toLowerCase().includes(search.toLowerCase())
    );

    const submit = async e => {
        e.preventDefault();
        setError(''); setSaving(true);
        try {
            plan?.id ? await api.updateTraining(plan.id, form) : await api.createTraining(form);
            onSave();
        } catch (err) {
            console.error(err);
            setError(`Failed to save: ${err?.status || ''} ${err.message}`);
            setSaving(false);
        }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && confirmClose()}
        >
            <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>{plan?.id ? 'Edit training plan' : 'Add training plan'}</h2>
                    <button onClick={confirmClose} className="btn btn-ghost btn-sm"><i className="ti ti-x" /></button>
                </div>
                {error && <div className="alert-error">{error}</div>}
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                        <label className="form-label">Name *</label>
                        <input value={form.name} onChange={set('name')} placeholder="e.g. Long run 30 km" required />
                    </div>
                    <div className="grid-form-2">
                        <div className="form-group">
                            <label className="form-label">Date *</label>
                            <input type="date" value={form.plan_date} onChange={set('plan_date')} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Time (optional)</label>
                            <input value={form.plan_time} onChange={set('plan_time')} placeholder="e.g. 05:30 or Morning" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Related race (optional)</label>
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); if (!e.target.value) { setForm(f => ({ ...f, race_id: '' })); setDirty(true); } }}
                            placeholder="Search races…"
                            style={{ marginBottom: 4 }}
                        />
                        {search && (
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', maxHeight: 160, overflowY: 'auto', background: 'var(--color-surface)' }}>
                                <div
                                    onClick={() => { setForm(f => ({ ...f, race_id: '' })); setSearch(''); }}
                                    style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}
                                >— None</div>
                                {filteredRaces.map(r => (
                                    <div
                                        key={r.id}
                                        onClick={() => { setForm(f => ({ ...f, race_id: r.id })); setSearch(r.event_name); setDirty(true); }}
                                        style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', background: form.race_id === r.id ? 'var(--color-primary-bg)' : '', color: form.race_id === r.id ? 'var(--color-primary)' : '' }}
                                        onMouseEnter={e => { if (form.race_id !== r.id) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                        onMouseLeave={e => { if (form.race_id !== r.id) e.currentTarget.style.background = ''; }}
                                    >
                                        <div style={{ fontWeight: 500 }}>{r.event_name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{r.race_date?.slice(0, 10)}</div>
                                    </div>
                                ))}
                                {filteredRaces.length === 0 && <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--color-text-hint)' }}>No races found</div>}
                            </div>
                        )}
                        {form.race_id && !search && (
                            <div style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 2 }}>
                                ✓ {races.find(r => r.id === form.race_id)?.event_name}
                                <button type="button" onClick={() => { setForm(f => ({ ...f, race_id: '' })); setSearch(''); }}
                                        style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--color-text-hint)', cursor: 'pointer', fontSize: 12 }}>×</button>
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes (optional)</label>
                        <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Details, targets, gear…" style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <button type="button" onClick={confirmClose} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <i className={`ti ${saving ? 'ti-loader' : 'ti-check'}`} />
                            {saving ? 'Saving…' : plan?.id ? 'Save changes' : 'Add plan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}