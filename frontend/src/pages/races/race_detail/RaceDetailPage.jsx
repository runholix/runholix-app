import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import { useAuth } from '../../../hooks/useAuth.jsx';
import RegistrationSection from "./RegistrationSection.jsx";
import EventInfoSection from "./EventInfoSection.jsx";
import RaceDetailSection from "./RaceDetailSection.jsx";
import FacilitySection from "./FacilitySection.jsx";
import RacePackCollectionSection from "./RacePackCollectionSection.jsx";
import MandatoryItemsSection from "./MandatoryItemsSection.jsx";
import LinkSection from "./LinkSection.jsx";
import ResultSection from "./ResultSection.jsx";
import HeaderSection from "./HeaderSection.jsx";
import TabButton from "../../../components/TabButton.jsx";

function hasAnyValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(hasAnyValue);
  if (typeof value === 'object') return Object.values(value).some(hasAnyValue);
  return String(value).trim() !== '';
}

export function Field({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 500, fontFamily: mono ? 'monospace' : undefined, fontSize: 14 }}>{value}</div>
    </div>
  );
}

export function Section({ title, children }) {
  const anyChild = Array.isArray(children) ? children.some(Boolean) : !!children;
  if (!anyChild) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="form-section-title">{title}</div>
      <div className="detail-fields">{children}</div>
    </div>
  );
}

export default function RaceDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const fromCalendar = location.state?.from === 'calendar';
  const fromRaces = location.state?.fromRaces; // { filters, page } from RacesPage
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    api.getRace(id).then(setRace).catch((err) => {
        console.error(err);
        setError(`Failed to load race details: ${err?.status || ''} ${err.message}`);
    }).finally(() => setLoading(false));
  }, [id]);

  const infoTabVisible = Boolean(race) && (
    hasAnyValue(race.event_name) ||
    hasAnyValue(race.race_date) ||
    hasAnyValue(race.status) ||
    hasAnyValue(race.flag_off_time) ||
    hasAnyValue(race.cutoff_time) ||
    hasAnyValue(race.location) ||
    hasAnyValue(race.city) ||
    hasAnyValue(race.country) ||
    hasAnyValue(race.website_url) ||
    hasAnyValue(race.instagram_url) ||
    hasAnyValue(race.timezone) ||
    hasAnyValue(race.registration_datetime) ||
    hasAnyValue(race.distance_km) ||
    hasAnyValue(race.distance_label) ||
    hasAnyValue(race.race_type) ||
    hasAnyValue(race.category) ||
    hasAnyValue(race.elevation_gain_req_m) ||
    hasAnyValue(race.itra_point) ||
    (Array.isArray(race.facilities) && race.facilities.length > 0) ||
    hasAnyValue(race.route_file_path) ||
    hasAnyValue(race.route_file_name) ||
    hasAnyValue(race.itra_url) ||
    hasAnyValue(race.bib_number) ||
    hasAnyValue(race.bib_name) ||
    hasAnyValue(race.confirmation_number) ||
    hasAnyValue(race.registration_fee) ||
    hasAnyValue(race.registration_currency) ||
    hasAnyValue(race.jersey_size) ||
    hasAnyValue(race.registered_email) ||
    hasAnyValue(race.registered_phone) ||
    hasAnyValue(race.finish_time_target) ||
    hasAnyValue(race.attachment_path) ||
    hasAnyValue(race.attachment_name) ||
    hasAnyValue(race.qualification) ||
    hasAnyValue(race.notes) ||
    hasAnyValue(race.race_report) ||
    hasAnyValue(race.results_url) ||
    hasAnyValue(race.certificate_url) ||
    hasAnyValue(race.strava_url) ||
    hasAnyValue(race.result_file_path) ||
    hasAnyValue(race.result_file_name) ||
    hasAnyValue(race.rpc_date_start) ||
    hasAnyValue(race.rpc_date_end) ||
    hasAnyValue(race.rpc_time) ||
    hasAnyValue(race.rpc_location) ||
    hasAnyValue(race.rpc_status) ||
    hasAnyValue(race.rpc_attachment_path) ||
    hasAnyValue(race.rpc_attachment_name) ||
    hasAnyValue(race.rpc_notes) ||
    (Array.isArray(race.mandatory_items) && race.mandatory_items.length > 0)
  );
  const rpcTabVisible = Boolean(race) && (
    hasAnyValue(race.rpc_date_start) ||
    hasAnyValue(race.rpc_date_end) ||
    hasAnyValue(race.rpc_time) ||
    hasAnyValue(race.rpc_location) ||
    race.rpc_status !== 'not_collected' ||
    hasAnyValue(race.rpc_attachment_path) ||
    hasAnyValue(race.rpc_attachment_name) ||
    hasAnyValue(race.rpc_notes) ||
    (race.race_type === 'trail' && Array.isArray(race.mandatory_items) && race.mandatory_items.length > 0)
  );
  const resultTabVisible = Boolean(race) && (
    hasAnyValue(race.finish_time) ||
    hasAnyValue(race.gun_time) ||
    hasAnyValue(race.overall_place) ||
    hasAnyValue(race.overall_total) ||
    hasAnyValue(race.gender_place) ||
    hasAnyValue(race.gender_total) ||
    hasAnyValue(race.age_group_place) ||
    hasAnyValue(race.age_group_total) ||
    hasAnyValue(race.age_group_label) ||
    hasAnyValue(race.heart_rate_avg) ||
    hasAnyValue(race.heart_rate_max) ||
    hasAnyValue(race.actual_distance_km) ||
    hasAnyValue(race.elevation_gain_m) ||
    hasAnyValue(race.weather_temp_c) ||
    hasAnyValue(race.weather_condition) ||
    hasAnyValue(race.results_url) ||
    hasAnyValue(race.certificate_url) ||
    hasAnyValue(race.strava_url) ||
    hasAnyValue(race.result_file_path) ||
    hasAnyValue(race.result_file_name) ||
    hasAnyValue(race.notes) ||
    hasAnyValue(race.race_report)
  );
  const visibleTabs = [
    infoTabVisible ? 'info' : null,
    rpcTabVisible ? 'rpc' : null,
    resultTabVisible ? 'result' : null,
  ].filter(Boolean);
  const fallbackTab = visibleTabs[0] || 'info';
  const tab = visibleTabs.includes(activeTab) ? activeTab : fallbackTab;

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <Link
        to={fromCalendar ? '/calendar' : '/races'}
        state={fromCalendar
          ? undefined
          : { ...fromRaces, restorePage: true, scrollToRaceId: id }
        }
        style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
      >
        <i className="ti ti-arrow-left" /> {fromCalendar ? 'Back to calendar' : 'Back to races'}
      </Link>

      {loading ? (
        <div className="alert-info">Loading...</div>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : (
          race ? (
              <>
                  <HeaderSection race={race} id={id} rpcTabVisible={rpcTabVisible} />

                  <div className="card">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                        <TabButton hidden={!infoTabVisible} active={tab === 'info'} onClick={() => setActiveTab('info')} icon="ti-info-circle">Info</TabButton>
                        <TabButton hidden={!rpcTabVisible} active={tab === 'rpc'} onClick={() => setActiveTab('rpc')} icon="ti-package">RPC</TabButton>
                        <TabButton hidden={!resultTabVisible} active={tab === 'result'} onClick={() => setActiveTab('result')} icon="ti-chart-bar">Result</TabButton>
                      </div>

                      {tab === 'info' && (
                        <>
                          <EventInfoSection user={user} race={race} />
                          <RegistrationSection user={user} race={race} />
                          <RaceDetailSection race={race} />
                          {Array.isArray(race.facilities) && race.facilities.length > 0 && (
                            <FacilitySection race={race} />
                          )}
                          {(race.website_url || race.instagram_url || race.results_url || race.certificate_url || race.strava_url || (race.race_type === 'trail' && race.itra_url)) && (
                            <LinkSection race={race} />
                          )}
                        </>
                      )}

                      {tab === 'rpc' && (
                        <>
                          {(race.rpc_date_start || race.rpc_time || race.rpc_location || race.rpc_notes || race.rpc_attachment_path) && (
                            <RacePackCollectionSection user={user} race={race} />
                          )}
                          {race.race_type === 'trail' && Array.isArray(race.mandatory_items) && race.mandatory_items.length > 0 && (
                            <MandatoryItemsSection race={race} />
                          )}
                        </>
                      )}

                      {tab === 'result' && (
                        <>
                          <ResultSection user={user} race={race} />
                          {race.notes && (
                            <div style={{ marginBottom: 20 }}>
                              <div className="form-section-title">Notes</div>
                              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{race.notes}</p>
                            </div>
                          )}
                          {race.race_report && (
                            <div>
                              <div className="form-section-title">Race report</div>
                              <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{race.race_report}</p>
                            </div>
                          )}
                        </>
                      )}
                  </div>
              </>
          ) : (
            <div className="alert-error">Race data not found.</div>
          )
      )}

    </div>
  );
}
