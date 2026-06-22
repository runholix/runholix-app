import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Bump this to bust the avatar URL cache without changing user.avatar_path
  const [avatarTs, setAvatarTs] = useState(() => Date.now());

  useEffect(() => {
    api.me()
      .then(u => setUser(u))
      .catch(() => {
        localStorage.removeItem('rt_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem('rt_token', data.token);
    setUser(data.user);
  };

  const loginWithToken = (data) => {
    localStorage.setItem('rt_token', data.token);
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const data = await api.register({ name, email, password });
    localStorage.setItem('rt_token', data.token);
    setUser(data.user);
  };

  const logout = () => {
    api.logout().catch(() => {}).finally(() => {
      localStorage.removeItem('rt_token');
      sessionStorage.removeItem('rt_csrf_token');
      sessionStorage.removeItem('rt_csrf_token_ts');
      setUser(null);
    });
  };

  // Called by SettingsPage after profile updates
  const updateUser = (patch) => {
    setUser(u => ({ ...u, ...patch }));
    // If avatar changed, bump timestamp to force image reload
    if ('avatar_path' in patch) setAvatarTs(Date.now());
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, logout, updateUser, avatarTs }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
