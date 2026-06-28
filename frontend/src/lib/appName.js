// App name — set via VITE_APP_NAME env var in .env / docker-compose
// Falls back to 'Runholix' if not configured
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Runholix Demo';
export default APP_NAME;
