import { useState } from 'react';
import Login from './components/Login';
import Simulador from './components/Simulador';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  return user
    ? <Simulador user={user} onLogout={() => setUser(null)} />
    : <Login onLogin={setUser} />;
}