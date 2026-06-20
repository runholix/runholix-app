import { useState } from "react";
import { api } from "../../lib/api.js";
import { Section } from "./SettingsPage.jsx";
import Alert from "../../components/Alert.jsx";

export default function PasswordSection() {
    const [form, setForm] = useState({ current: '', next: '', confirm: '' });
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

    const submit = async e => {
        e.preventDefault();
        if (form.next !== form.confirm)
            return setResult({ type: 'error', message: 'New passwords do not match.' });
        if (form.next.length < 8)
            return setResult({ type: 'error', message: 'Password must be at least 8 characters.' });
        setSaving(true); setResult(null);
        try {
            await api.changePassword({ current_password: form.current, new_password: form.next });
            setForm({ current: '', next: '', confirm: '' });
            setResult({ type: 'success', message: 'Password updated. A confirmation email has been sent.' });
        } catch (err) {
            setResult({ type: 'error', message: err.message });
        } finally { setSaving(false); }
    };

    const strength = (() => {
        const p = form.next;
        if (!p) return null;
        let score = 0;
        if (p.length >= 8)  score++;
        if (p.length >= 12) score++;
        if (/[A-Z]/.test(p)) score++;
        if (/[0-9]/.test(p)) score++;
        if (/[^A-Za-z0-9]/.test(p)) score++;
        if (score <= 1) return { label: 'Weak',   color: 'var(--color-danger)',  pct: 25 };
        if (score <= 2) return { label: 'Fair',   color: 'var(--color-warning)', pct: 50 };
        if (score <= 3) return { label: 'Good',   color: '#0ea5e9',              pct: 75 };
        return               { label: 'Strong', color: 'var(--color-success)', pct: 100 };
    })();

    return (
        <Section title="Password" description="Use a strong, unique password. You'll receive an email notification when it changes.">
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                    <label className="form-label">Current password *</label>
                    <input type="password" value={form.current} onChange={set('current')} placeholder="••••••••" required />
                </div>
                <div className="grid-form-2">
                    <div className="form-group">
                        <label className="form-label">New password *</label>
                        <input type="password" value={form.next} onChange={set('next')} placeholder="Min 8 characters" required minLength={8} />
                        {strength && (
                            <div style={{ marginTop: 6 }}>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, transition: 'width 0.3s, background 0.3s' }} />
                                </div>
                                <div style={{ fontSize: 11, color: strength.color, marginTop: 3, fontWeight: 500 }}>{strength.label}</div>
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm new password *</label>
                        <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat new password" required />
                        {form.confirm && form.next !== form.confirm && (
                            <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>Passwords do not match</div>
                        )}
                    </div>
                </div>
                <div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !form.current || !form.next || !form.confirm}>
                        {saving ? 'Updating…' : 'Update password'}
                    </button>
                </div>
                <Alert {...(result || {})} />
            </form>
        </Section>
    );
}