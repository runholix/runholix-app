import { useState } from "react";
import { api } from "../../lib/api.js";
import { Section } from "./SettingsPage.jsx";
import Alert from "../../components/Alert.jsx";

export default function EmailSection({ user }) {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [saving, setSaving]     = useState(false);
    const [result, setResult]     = useState(null);
    const [sent, setSent]         = useState(false);

    const submit = async e => {
        e.preventDefault();
        setSaving(true); setResult(null);
        try {
            const res = await api.requestEmailChange({ new_email: newEmail, password });
            setSent(true);
            setResult({ type: 'success', message: res.message });
            setNewEmail(''); setPassword('');
        } catch (err) {
            setResult({ type: 'error', message: err.message });
        } finally { setSaving(false); }
    };

    return (
        <Section title="Email address" description={<>Current email: <strong>{user?.email}</strong></>}>
            {sent ? (
                <Alert type="info" message="Check your new email inbox for a confirmation link. Your email will only change once you click it." />
            ) : (
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="grid-form-2">
                        <div className="form-group">
                            <label className="form-label">New email address *</label>
                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Current password (to confirm) *</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                        </div>
                    </div>
                    <div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                            {saving ? 'Sending…' : 'Send confirmation email'}
                        </button>
                    </div>
                    <Alert {...(result || {})} />
                </form>
            )}
        </Section>
    );
}