import { Field, Section } from "./RaceDetailPage.jsx";
import { fmtNum, fmtTime, paceStr } from "../../../lib/utils.js";
import { api } from "../../../lib/api.js";

export default function ResultSection({ user, race }) {
    return (
        <>
            {race.status === 'completed' && (
                <Section title="Results">
                    <Field label="Finish time (chip)" value={
                        race.finish_time_seconds
                            ? [fmtTime(race.finish_time_seconds), paceStr(race.finish_time_seconds, (race?.actual_distance_km || race.distance_km))].filter(Boolean).join(' · ')
                            : null
                    } mono />
                    <Field label="Gun time" value={
                        race.gun_time_seconds
                            ? [fmtTime(race.gun_time_seconds), paceStr(race.gun_time_seconds, (race?.actual_distance_km || race.distance_km))].filter(Boolean).join(' · ')
                            : null
                    } mono />
                    <Field label="Overall" value={race.overall_place ? `${Number(race.overall_place).toLocaleString("en-US")}${race.overall_total ? ` / ${Number(race.overall_total).toLocaleString("en-US")}` : ''}` : null} />
                    <Field label="Gender" value={race.gender_place ? `${Number(race.gender_place).toLocaleString("en-US")}${race.gender_total ? ` / ${Number(race.gender_total).toLocaleString("en-US")}` : ''}` : null} />
                    <Field label="Age group" value={race.age_group_place ? `${Number(race.age_group_place).toLocaleString("en-US")}${race.age_group_total ? ` / ${Number(race.age_group_total).toLocaleString("en-US")}` : ''} ${race.age_group_label || ''}`.trim() : null} />
                </Section>
            )}

            {/* Result file download (outside completed guard — may be uploaded anytime) */}
            {race.result_file_path && race.result_file_name && (
                <div style={{ marginBottom: 24 }}>
                    <div className="form-section-title">Result file</div>
                    <a
                        href={api.resultFileUrl(user?.id, race.result_file_path.split('/').pop(), race.result_file_name)}
                        download={race.result_file_name}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex' }}
                    >
                        <i className="ti ti-download" /> {race.result_file_name}
                    </a>
                </div>
            )}

            {(race.heart_rate_avg || race.actual_distance_km || race.elevation_gain_m || race.weather_condition) && (
                <Section title="Conditions & vitals">
                    <Field label="Avg heart rate" value={fmtNum(race.heart_rate_avg, { suffix: 'bpm' })} />
                    <Field label="Max heart rate" value={fmtNum(race.heart_rate_max, { suffix: 'bpm' })} />
                    <Field label="Actual distance" value={fmtNum(race.actual_distance_km, { decimals: 3, suffix: 'km' })} />
                    <Field label="Elevation gain" value={fmtNum(race.elevation_gain_m, { suffix: 'm' })} />
                    <Field label="Temperature" value={race.weather_temp_c != null ? `${Number(race.weather_temp_c).toLocaleString("en-US")}°C` : null} />
                    <Field label="Weather" value={race.weather_condition} />
                </Section>
            )}
        </>
    )
}