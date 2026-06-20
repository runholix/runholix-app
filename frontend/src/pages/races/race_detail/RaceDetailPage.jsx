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

  useEffect(() => {
    api.getRace(id).then(setRace).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>;
  if (!race) return <div className="page">Race not found.</div>;

  return (
    <div className="page" style={{ maxWidth: 900 }}>
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

      <HeaderSection race={race} id={id} />

      <div className="card">
        <EventInfoSection user={user} race={race} />
        <RegistrationSection user={user} race={race} />
        <RaceDetailSection race={race} />

        {Array.isArray(race.facilities) && race.facilities.length > 0 && (
          <FacilitySection race={race} />
        )}

        {(race.rpc_date_start || race.rpc_time || race.rpc_location || race.rpc_notes || race.rpc_attachment_path) && (
          <RacePackCollectionSection user={user} race={race} />
        )}

        {race.race_type === 'trail' && Array.isArray(race.mandatory_items) && race.mandatory_items.length > 0 && (
          <MandatoryItemsSection race={race} />
        )}

        <ResultSection user={user} race={race} />

        {(race.website_url || race.instagram_url || race.results_url || race.certificate_url || race.strava_url || (race.race_type === 'trail' && race.itra_url)) && (
          <LinkSection race={race} />
        )}

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
      </div>
    </div>
  );
}
