import Field from "../../../components/Field.jsx";

export default function DistanceCategorySection ({ isTrail, set, form }) {
    return (
        <>
            <div className="form-section-title">Distance & category</div>
            <div className="grid-form-4" style={{ marginBottom: isTrail ? 14 : 16 }}>
                <Field label="Distance (km)">
                    <input type="number" value={form.distance_km} onChange={set('distance_km')} placeholder="42.195" step="0.001" />
                </Field>
                <Field label="Distance label">
                    <input value={form.distance_label} onChange={set('distance_label')} placeholder="Full Marathon" />
                </Field>
                <Field label="Race type">
                    <select value={form.race_type} onChange={set('race_type')}>
                        <option value="road">Road</option>
                        <option value="trail">Trail</option>
                        <option value="track">Track</option>
                        <option value="virtual">Virtual</option>
                        <option value="other">Other</option>
                    </select>
                </Field>
                <Field label="Category / wave">
                    <input value={form.category} onChange={set('category')} placeholder="Open Male" />
                </Field>
            </div>

            {/* Trail-only: Elevation gain + ITRA point */}
            {isTrail && (
                <div className="grid-form-2" style={{ marginBottom:16 }}>
                    <Field label="Elevation gain (m)" hint="Total positive elevation for trail races">
                        <input type="number" value={form.elevation_gain_req_m} onChange={set('elevation_gain_req_m')}
                               placeholder="2500" />
                    </Field>
                    <Field label="ITRA point" hint="International Trail Running Association points">
                        <input type="text" value={form.itra_point} onChange={set('itra_point')} placeholder="e.g. 3 or 250" />
                    </Field>
                </div>
            )}
        </>
    )
}