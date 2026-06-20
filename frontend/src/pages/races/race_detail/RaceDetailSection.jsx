import {Field, Section} from "./RaceDetailPage.jsx";
import {fmtNum} from "../../../lib/utils.js";

export default function RaceDetailSection({ race }) {
    return (
        <Section title="Race details">
            <Field label="Distance" value={race.distance_label || fmtNum(race.distance_km, { decimals: 2, suffix: 'km' })} />
            <Field label="Race type" value={race.race_type ? race.race_type.charAt(0).toUpperCase() + race.race_type.slice(1) : null} />
            {race.race_type === 'trail' && (
                <Field label="Elevation gain (required)" value={fmtNum(race.elevation_gain_req_m, { suffix: 'm' })} />
            )}
            {race.race_type === 'trail' && race.itra_point != null && race.itra_point !== '' && (
                <Field label="ITRA points" value={race.itra_point || null} />
            )}
        </Section>
    )
}