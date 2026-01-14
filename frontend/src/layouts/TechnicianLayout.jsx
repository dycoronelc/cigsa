import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

export default function TechnicianLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/technician/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/technician/work-orders', label: 'Mis Órdenes', icon: '📋' },
    { path: '/technician/calendar', label: 'Calendario', icon: '📅' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout technician-layout">
      <header className="header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <div className="header-logo-title">
          <img src="/cigsa.png" alt="CIGSA Logo" className="header-logo" />
          <h1>CIGSA - Técnico</h1>
        </div>
        <div className="header-user">
          <span>{user?.fullName}</span>
          <button onClick={handleLogout} className="btn-logout">Salir</button>
        </div>
      </header>

      <div className="layout-content">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav>
            {menuItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

