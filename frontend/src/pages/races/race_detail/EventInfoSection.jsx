import { Field, Section } from "./RaceDetailPage.jsx";
import {api} from "../../../lib/api.js";

export default function EventInfoSection({ user, race }) {
    const showTimezone = race.timezone && race.timezone !== user?.timezone;
    return (
        <>
            <Section title="Event info">
                <Field label="Flag off time" value={race.flag_off_time} />
                <Field label="Cut off time" value={race.cutoff_time} />
                <Field label="Location" value={race.location} />
                <Field label="City" value={race.city} />
                <Field label="Country" value={race.country} />
                {showTimezone && <Field label="Timezone" value={race.timezone} />}

            </Section>

            {/* Route file download */}
            {race.route_file_path && race.route_file_name && (
                <div style={{ marginBottom: 24 }}>
                    <div className="form-section-title">Route file</div>
                    <a
                        href={api.routeFileUrl(user?.id, race.route_file_path.split('/').pop(), race.route_file_name)}
                        download={race.route_file_name}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex' }}
                    >
                        <i className="ti ti-download" /> {race.route_file_name}
                    </a>
                </div>
            )}
        </>
    )
}
