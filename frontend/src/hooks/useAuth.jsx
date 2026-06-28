// Mock auth hook — always returns a logged-in demo user, no API call needed.
import { createContext, useContext, useState } from 'react';

const MOCK_USER = {
  id: 1,
  name: 'Alex Runner',
  email: 'alex@example.com',
  timezone: 'Asia/Jakarta',
  avatar_path: null,
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState({ ...MOCK_USER });
  const [avatarTs] = useState(() => Date.now());

  const login = async () => setUser({ ...MOCK_USER });
  const loginWithToken = () => setUser({ ...MOCK_USER });
  const register = async () => setUser({ ...MOCK_USER });
  const logout = () => {};
  const updateUser = (patch) => setUser(u => ({ ...u, ...patch }));

  return (
      <AuthContext.Provider value={{ user, loading: false, login, loginWithToken, register, logout, updateUser, avatarTs }}>
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
