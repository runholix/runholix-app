import { useState } from "react";
import { api } from "../../lib/api.js";
import { Section } from "./SettingsPage.jsx";
import Alert from "../../components/Alert.jsx";

export default function NameSection({ user, onUpdate }) {
    const [name, setName]     = useState(user?.name || '');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);

    const submit = async e => {
        e.preventDefault();
        setSaving(true); setResult(null);
        try {
            const updated = await api.updateName({ name });
            onUpdate(updated);
            setResult({ type: 'success', message: 'Name updated successfully.' });
        } catch (err) {
            setResult({ type: 'error', message: err.message });
        } finally { setSaving(false); }
    };

    return (
        <Section title="Display name" description="Your name shown across the app.">
            <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: '1 1 220px' }}>
                    <label className="form-label">Full name *</label>
                    <input value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !name.trim() || name.trim() === user?.name}>
                    {saving ? 'Saving…' : 'Update name'}
                </button>
            </form>
            <Alert {...(result || {})} />
        </Section>
    );
}