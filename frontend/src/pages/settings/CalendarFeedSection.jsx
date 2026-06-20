import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { Section } from "./SettingsPage.jsx";
import Alert from "../../components/Alert.jsx";

export default function CalendarFeedSection() {
    const [enabled, setEnabled] = useState(false);
    const [feedUrl, setFeedUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        api.getIcal().then(data => {
            setEnabled(data.ical_enabled);
            // feed_url may be relative (e.g. /ical/token.ics) if APP_URL not set
            const url = data.feed_url
                ? data.feed_url.startsWith('http')
                    ? data.feed_url
                    : `${window.location.origin}${data.feed_url}`
                : '';
            setFeedUrl(url);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const toggle = async () => {
        setSaving(true); setResult(null);
        try {
            const data = await api.toggleIcal({ action: enabled ? 'disable' : 'enable' });
            setEnabled(data.ical_enabled);
            const url = data.feed_url
                ? data.feed_url.startsWith('http')
                    ? data.feed_url
                    : `${window.location.origin}${data.feed_url}`
                : '';
            setFeedUrl(url);
            setResult({ type: 'success', message: data.ical_enabled ? 'Calendar feed enabled.' : 'Calendar feed disabled.' });
        } catch (err) {
            setResult({ type: 'error', message: err.message });
        } finally { setSaving(false); }
    };

    const regenerate = async () => {
        if (!window.confirm('Regenerate the calendar URL? Your current subscription link will stop working and you will need to re-add the new URL to your calendar app.')) return;
        setSaving(true); setResult(null);
        try {
            const data = await api.toggleIcal({ action: 'regenerate' });
            setEnabled(true);
            const url = data.feed_url
                ? data.feed_url.startsWith('http')
                    ? data.feed_url
                    : `${window.location.origin}${data.feed_url}`
                : '';
            setFeedUrl(url);
            setResult({ type: 'success', message: 'New calendar URL generated.' });
        } catch (err) {
            setResult({ type: 'error', message: err.message });
        } finally { setSaving(false); }
    };

    const copy = () => {
        navigator.clipboard.writeText(feedUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (loading) return null;

    return (
        <Section
            title="Calendar feed"
            description="Subscribe to your races, RPC dates and training plans in any calendar app (Apple Calendar, Google Calendar, Outlook, etc.)"
        >
            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>iCal / WebCal subscription</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {enabled ? 'Your calendar feed is active.' : 'Enable to get a subscription URL.'}
                    </div>
                </div>
                <button
                    onClick={toggle}
                    disabled={saving}
                    className={`btn btn-sm ${enabled ? 'btn-secondary' : 'btn-primary'}`}
                >
                    <i className={`ti ${enabled ? 'ti-player-stop' : 'ti-player-play'}`} />
                    {saving ? 'Saving…' : enabled ? 'Disable feed' : 'Enable feed'}
                </button>
            </div>

            {/* Feed URL */}
            {enabled && feedUrl && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                        Subscription URL
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 10px',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                    }}>
                        <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', color: 'var(--color-text-muted)', overflow: 'hidden' }}>
                            {feedUrl}
                        </code>
                        <button onClick={copy} className="btn btn-ghost btn-sm" title="Copy URL" style={{ flexShrink: 0 }}>
                            <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ color: copied ? 'var(--color-success)' : undefined }} />
                        </button>
                    </div>

                    {/* Quick-add links */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <a
                            href={`webcal://${feedUrl.replace(/^https?:\/\//, '')}`}
                            className="btn btn-secondary btn-sm"
                            title="Subscribe in Apple Calendar or compatible apps"
                        >
                            <i className="ti ti-calendar-plus" /> Subscribe (webcal)
                        </a>
                        <a
                            href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl.replace(/^https?/, 'webcal'))}`}
                            target="_blank" rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                        >
                            <i className="ti ti-brand-google" /> Add to Google
                        </a>
                    </div>

                    {/* Regenerate */}
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                            If you suspect your URL has been shared, regenerate a new one. Your existing subscriptions will need to be updated.
                        </div>
                        <button onClick={regenerate} className="btn btn-secondary btn-sm" disabled={saving}>
                            <i className="ti ti-refresh" /> Regenerate URL
                        </button>
                    </div>
                </div>
            )}

            <Alert {...(result || {})} />
        </Section>
    );
}