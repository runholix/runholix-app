import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { api } from "../../lib/api.js";
import { Section } from "./SettingsPage.jsx";
import Alert from "../../components/Alert.jsx";
import RequiredMarker from "../../components/RequiredMarker.jsx";

function fmtDate(value) {
    if (!value) return "Never";
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PasskeySection() {
    const [passkeys, setPasskeys] = useState([]);
    const [name, setName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.getPasskeys();
            setPasskeys(Array.isArray(data) ? data : []);
        } catch (err) {
            setResult({ type: "error", message: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const addPasskey = async e => {
        e.preventDefault();
        if (passkeys.length >= 3) return setResult({ type: "error", message: "You can register up to 3 passkeys." });
        if (!currentPassword) return setResult({ type: "error", message: "Current password is required." });
        setSaving(true); setResult(null);
        try {
            const options = await api.passkeyRegisterOptions({ current_password: currentPassword });
            const credential = await startRegistration({ optionsJSON: options });
            const created = await api.verifyPasskeyRegister({ credential, name: name.trim() || "Passkey" });
            setPasskeys(keys => {
                const current = Array.isArray(keys) ? keys : [];
                return [created, ...current];
            });
            setName("");
            setCurrentPassword("");
            setResult({ type: "success", message: "Passkey added. A confirmation email has been sent." });
        } catch (err) {
            setResult({ type: "error", message: err.message || "Could not add passkey." });
        } finally {
            setSaving(false);
        }
    };

    const removePasskey = async passkey => {
        if (!currentPassword) return setResult({ type: "error", message: "Enter your current password before removing a passkey." });
        if (!window.confirm(`Remove passkey "${passkey.name}"?`)) return;
        setResult(null);
        try {
            await api.deletePasskey(passkey.id, { current_password: currentPassword });
            setPasskeys(keys => keys.filter(k => k.id !== passkey.id));
            setCurrentPassword("");
            setResult({ type: "success", message: "Passkey removed. A confirmation email has been sent." });
        } catch (err) {
            setResult({ type: "error", message: err.message });
        }
    };

    return (
        <Section title="Passkeys" description="Use your device face ID, fingerprint, or security key to sign in without a password. You'll receive an email notification when you make changes.">
            {!supported && <Alert type="error" message="This browser does not support passkeys." />}
            {loading ? (
                <div className="alert-info">Loading passkeys...</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {passkeys.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {passkeys.map(passkey => (
                                <div key={passkey.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{passkey.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                                            Added {fmtDate(passkey.created_at)} - Last used {fmtDate(passkey.last_used_at)}
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => removePasskey(passkey)}>
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={addPasskey} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <div className="form-group" style={{ flex: "1 1 220px", marginBottom: 0 }}>
                            <label className="form-label">Passkey name <RequiredMarker /></label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Work laptop" maxLength={60} disabled={!supported || passkeys.length >= 3} required />
                        </div>
                        <div className="form-group" style={{ flex: "1 1 220px", marginBottom: 0 }}>
                            <label className="form-label">Current password <RequiredMarker /></label>
                            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Required for passkey changes" disabled={!supported} autoComplete="current-password" required />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={!supported || saving || passkeys.length >= 3}>
                            {saving ? "Adding..." : "Add passkey"}
                        </button>
                    </form>
                    <div style={{ fontSize: 12, color: passkeys.length >= 3 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                        {passkeys.length}/3 passkeys registered.
                    </div>
                    <Alert {...(result || {})} />
                </div>
            )}
        </Section>
    );
}
