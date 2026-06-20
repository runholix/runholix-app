import Field from "../../../components/Field.jsx";
import ResultFileUploader from "../../../components/ResultFileUploader.jsx";

export default function ResultSection ({ setVal, set, makeOnClear, form, userId, trackUpload }) {
    return (
        <>
            <div className="form-section-title">Results</div>
            <div className="grid-form-2" style={{ marginBottom:16 }}>
                <Field label="Finish time (chip) HH:MM:SS"><input value={form.finish_time} onChange={set('finish_time')} placeholder="04:32:15" /></Field>
                <Field label="Gun time HH:MM:SS"><input value={form.gun_time} onChange={set('gun_time')} placeholder="04:34:01" /></Field>
            </div>
            <div className="grid-form-6" style={{ marginBottom:16 }}>
                <Field label="Overall place"><input type="number" value={form.overall_place} onChange={set('overall_place')} /></Field>
                <Field label="Overall total"><input type="number" value={form.overall_total} onChange={set('overall_total')} /></Field>
                <Field label="Gender place"><input type="number" value={form.gender_place} onChange={set('gender_place')} /></Field>
                <Field label="Gender total"><input type="number" value={form.gender_total} onChange={set('gender_total')} /></Field>
                <Field label="Age group place"><input type="number" value={form.age_group_place} onChange={set('age_group_place')} /></Field>
                <Field label="Age group total"><input type="number" value={form.age_group_total} onChange={set('age_group_total')} /></Field>
            </div>
            <div className="grid-form-4" style={{ marginBottom:16 }}>
                <Field label="Age group label"><input value={form.age_group_label} onChange={set('age_group_label')} placeholder="M40-44" /></Field>
                <Field label="Avg HR (bpm)"><input type="number" value={form.heart_rate_avg} onChange={set('heart_rate_avg')} /></Field>
                <Field label="Max HR (bpm)"><input type="number" value={form.heart_rate_max} onChange={set('heart_rate_max')} /></Field>
                <Field label="Actual distance (km)">
                    <input type="number" value={form.actual_distance_km} onChange={set('actual_distance_km')} placeholder="42.10" step="0.001" />
                </Field>
                <Field label="Elevation gain (m) — actual">
                    <input type="number" value={form.elevation_gain_m} onChange={set('elevation_gain_m')} placeholder="Actual on race day" />
                </Field>
            </div>
            <div className="grid-form-3" style={{ marginBottom:16 }}>
                <Field label="Temp (°C)"><input type="number" value={form.weather_temp_c} onChange={set('weather_temp_c')} step="0.1" /></Field>
                <Field label="Weather">
                    <select value={form.weather_condition} onChange={set('weather_condition')}>
                        <option value="">—</option>
                        {['Sunny','Partly cloudy','Overcast','Light rain','Heavy rain','Hot & humid','Cool','Cold','Windy'].map(w => <option key={w}>{w}</option>)}
                    </select>
                </Field>
                <Field label="Official results URL"><input type="url" value={form.results_url} onChange={set('results_url')} placeholder="https://…" /></Field>
            </div>
            <div className="grid-form-2" style={{ marginBottom:16 }}>
                <Field label="Certificate URL"><input type="url" value={form.certificate_url} onChange={set('certificate_url')} placeholder="https://…" /></Field>
                <Field label="Strava URL (optional)">
                    <input type="url" value={form.strava_url} onChange={set('strava_url')} placeholder="https://www.strava.com/activities/…" />
                </Field>
            </div>
            <Field label="Result file (optional — .fit / .gpx / .kml)" hint="Metrics will be auto-filled from the file">
                <ResultFileUploader
                    filePath={form.result_file_path}
                    fileName={form.result_file_name}
                    userId={userId}
                    distanceKm={form.distance_km}
                    onChange={(path, name) => { setVal('result_file_path', path); setVal('result_file_name', name); trackUpload('result', path); }}
                    onClear={makeOnClear('result', form.result_file_path, () => { setVal('result_file_path', ''); setVal('result_file_name', ''); })}
                    onParsed={parsed => {
                        if (parsed.distanceKm    != null) setVal('actual_distance_km', String(parsed.distanceKm));
                        if (parsed.elevationGainM != null) setVal('elevation_gain_m', String(parsed.elevationGainM));
                        if (parsed.heartRateAvg  != null) setVal('heart_rate_avg', String(parsed.heartRateAvg));
                        if (parsed.heartRateMax  != null) setVal('heart_rate_max', String(parsed.heartRateMax));
                    }}
                />
            </Field>
        </>
    )
}