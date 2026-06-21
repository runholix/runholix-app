import { useState } from 'react';
import { api } from '../../lib/api.js';
import { Section } from './SettingsPage.jsx';
import Alert from '../../components/Alert.jsx';
import TimezoneSelect from "../../components/TimezoneSelect.jsx";

export default function TimezoneSection({ user, onUpdate }) {
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [filtered, setFiltered] = useState([]);
  const [timezoneExist, setTimezoneExist] = useState(false);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const updated = await api.updateTimezone({ timezone });
      onUpdate(updated);
      setResult({ type: 'success', message: 'Timezone updated successfully.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Timezone" description="Used for scheduling and accurate email reminder timing.">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TimezoneSelect timezone={timezone} setTimezone={setTimezone} onFilteredChange={setFiltered} onTimezoneExistChange={setTimezoneExist} />
        <div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !timezone.trim() || timezone === user?.timezone || filtered.length === 0 || !timezoneExist}>
            {saving ? 'Saving…' : 'Update timezone'}
          </button>
        </div>

        <Alert {...(result || {})} />
      </form>
    </Section>
  );
}
