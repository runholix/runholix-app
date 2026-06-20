import { useRef, useState } from "react";
import { fmtMB, parseActivityFile, routeLimitBytes, sanitiseFileName, validateRouteFile } from "../lib/utils.js";
import { api } from "../lib/api.js";

// ── Result file uploader — validate + parse + upload in parallel ─────────
export default function ResultFileUploader({ filePath, fileName, userId, distanceKm, onChange, onClear, onParsed }) {
    const inputRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [parseMsg, setParseMsg] = useState('');
    const [err, setErr] = useState('');

    const handleFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;

        // 1. Instant client-side validation — no round-trip
        const validErr = validateRouteFile(file, distanceKm);
        if (validErr) { setErr(validErr); e.target.value = ''; return; }

        setErr(''); setParseMsg(''); setUploading(true);

        // 2. Parse client-side AND upload to backend simultaneously
        const [clientResult, uploadResult] = await Promise.allSettled([
            parseActivityFile(file).catch(() => ({})),
            api.uploadResultFile(file, distanceKm),
        ]);

        setUploading(false);
        e.target.value = '';

        if (uploadResult.status === 'rejected') {
            console.error(uploadResult);
            setErr(`Failed to upload: ${uploadResult?.reason?.status || ''} ${uploadResult?.reason?.message || ''}`);
            return;
        }

        const res = uploadResult.value;
        const safeName = sanitiseFileName(res.route_file_name || res.result_file_name || file.name);
        const storedPath = res.route_file_path || res.result_file_path;
        onChange(storedPath, safeName);

        // 3. Prefer client parse; fall back to backend parse for missing metrics
        let parsed = clientResult.status === 'fulfilled' ? clientResult.value : {};

        const hasAnyMetric = v =>
            v.distanceKm != null ||
            v.elevationGainM != null ||
            v.heartRateAvg != null ||
            v.heartRateMax != null;

        const hasMissingMetric = v =>
            v.distanceKm == null ||
            v.elevationGainM == null ||
            v.heartRateAvg == null ||
            v.heartRateMax == null;

        if (hasMissingMetric(parsed) && storedPath && userId) {
            try {
                const sp = await api.parseResultFile(userId, storedPath.split('/').pop()).catch(() => null);
                if (sp) {
                    parsed = {
                        distanceKm: sp.distance_km ?? parsed.distanceKm ?? null,
                        elevationGainM: sp.elevation_gain_m ?? parsed.elevationGainM ?? null,
                        heartRateAvg: sp.heart_rate_avg ?? parsed.heartRateAvg ?? null,
                        heartRateMax: sp.heart_rate_max ?? parsed.heartRateMax ?? null,
                    };
                }
            } catch {
                // best-effort
            }
        }

        // 4. Autofill form fields
        if (hasAnyMetric(parsed)) {
            onParsed(parsed);
            const fields = [];
            if (parsed.distanceKm    != null) fields.push(`distance ${parsed.distanceKm} km`);
            if (parsed.elevationGainM != null) fields.push(`elevation ${parsed.elevationGainM} m`);
            if (parsed.heartRateAvg  != null) fields.push(`avg HR ${parsed.heartRateAvg} bpm`);
            if (parsed.heartRateMax  != null) fields.push(`max HR ${parsed.heartRateMax} bpm`);
            setParseMsg(`Auto-filled: ${fields.join(' · ')}`);
        } else {
            setParseMsg('Uploaded · No metrics could be extracted from this file');
        }
    };

    const handleRemove = () => {
        setParseMsg('');
        onClear(); // confirm + delete logic handled by makeOnClear in the form
    };

    const limit = routeLimitBytes(distanceKm);

    if (filePath && fileName) return (
        <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius)', marginBottom: parseMsg ? 6 : 0 }}>
                <i className="ti ti-file-vector" style={{ color:'var(--color-primary)', fontSize:18, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</span>
                <a href={api.resultFileUrl(userId, filePath.split('/').pop(), fileName)} download={fileName} className="btn btn-ghost btn-sm" title="Download"><i className="ti ti-download" /></a>
                <button type="button" onClick={handleRemove} className="btn btn-ghost btn-sm" title="Remove"><i className="ti ti-x" /></button>
            </div>
            {parseMsg && (
                <div style={{ fontSize:11, color:'var(--color-success)', display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                    <i className="ti ti-circle-check" /> {parseMsg}
                </div>
            )}
        </div>
    );

    return (
        <div>
            <input ref={inputRef} type="file" accept=".fit,.gpx,.kml" style={{ display:'none' }} onChange={handleFile} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()} disabled={uploading}>
                <i className="ti ti-upload" /> {uploading ? 'Uploading & parsing…' : 'Upload .fit / .gpx / .kml'}
            </button>
            <div style={{ fontSize:11, color:'var(--color-text-hint)', marginTop:3 }}>Max {fmtMB(limit)} · Metrics auto-filled from file</div>
            {err && <div style={{ color:'var(--color-danger)', fontSize:12, marginTop:4 }}>{err}</div>}
        </div>
    );
}