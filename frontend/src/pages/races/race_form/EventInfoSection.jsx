import Field from "../../../components/Field.jsx";
import RouteUploader from "../../../components/RouteUploader.jsx";
import TimezoneSelect from "../../../components/TimezoneSelect.jsx";

export default function EventInfoSection({ isTrail, setVal, trackUpload, makeOnClear, set, form, userId, raceDateExists }) {
    return (
        <>
            <div className="form-section-title" style={{ marginTop:0 }}>Event info</div>

            <div className="form-group" style={{ marginBottom:14 }}>
                <label className="form-label">Event name *</label>
                <input value={form.event_name} onChange={set('event_name')} placeholder="e.g. Jakarta Marathon 2024" required />
            </div>

            <div className="grid-form-2" style={{ marginBottom:14 }}>
                <Field label="Race date *">
                    <input type="date" value={form.race_date} onChange={set('race_date')} required />
                    {raceDateExists && (
                        <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2 }}>
                            A race already exists on this date.
                        </span>
                    )}
                </Field>
                <Field label="Status">
                    <select value={form.status} onChange={set('status')}>
                        <option value="registered">Registered</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                        <option value="dnf">DNF</option>
                        <option value="dns">DNS</option>
                    </select>
                </Field>
            </div>

            {form.status === 'upcoming' && (
                <div className="grid-form-2" style={{ marginBottom:14 }}>
                    <Field label="Registration date time">
                        <input
                            type="datetime-local"
                            value={form.registration_datetime}
                            onChange={set('registration_datetime')}
                            max={form.race_date ? `${form.race_date}T23:59` : undefined}
                        />
                    </Field>
                </div>
            )}

            <div className="grid-form-2" style={{ marginBottom:14 }}>
                <Field label="Flag off time (HH:MM)" hint="24-hour format e.g. 05:30">
                    <input value={form.flag_off_time} onChange={set('flag_off_time')} placeholder="05:30"
                           pattern="^([01]\d|2[0-3]):[0-5]\d$" title="HH:MM in 24-hour format" />
                </Field>
                <Field label="Cut off time (e.g. 3h 30m)" hint="Accepts: 3h 30m · 3h · 30m">
                    <input value={form.cutoff_time} onChange={set('cutoff_time')} placeholder="3h 30m"
                           pattern="^(\d+h\s*\d+m|\d+h|\d+m)$"
                           title="Format: Xh Ym (e.g. 3h 30m), Xh only (e.g. 3h), or Ym only (e.g. 90m)" />
                </Field>
            </div>

            <div className="grid-form-2" style={{ marginBottom:14 }}>
                <Field label="City"><input value={form.city} onChange={set('city')} placeholder="Jakarta" /></Field>
                <Field label="Country"><input value={form.country} onChange={set('country')} placeholder="Indonesia" /></Field>
                <Field label="Venue / location"><input value={form.location} onChange={set('location')} placeholder="Monas area" /></Field>
                <Field label="Race website URL"><input type="url" value={form.website_url} onChange={set('website_url')} placeholder="https://…" /></Field>
                <Field label="Instagram URL"><input type="url" value={form.instagram_url} onChange={set('instagram_url')} placeholder="https://www.instagram.com/racehandle" /></Field>
                <TimezoneSelect label="Race timezone" timezone={form.timezone} setTimezone={tz => setVal('timezone', tz)} />
            </div>

            {/* Trail-only: ITRA URL */}
            {isTrail && (
                <div style={{ marginBottom:14 }}>
                    <Field label="ITRA URL" hint="Link to race page on itra.run">
                        <input type="url" value={form.itra_url} onChange={set('itra_url')} placeholder="https://itra.run/Races/..." />
                    </Field>
                </div>
            )}

            <Field label="Route file">
                <RouteUploader filePath={form.route_file_path} fileName={form.route_file_name} userId={userId}
                               distanceKm={form.distance_km}
                               onChange={(path, name) => { setVal('route_file_path', path); setVal('route_file_name', name); trackUpload('route', path); }}
                               onClear={makeOnClear('route', form.route_file_path, () => { setVal('route_file_path', ''); setVal('route_file_name', ''); })} />
            </Field>
        </>
    )
}
