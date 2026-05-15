import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/work-orders', label: 'Órdenes de Trabajo', icon: '📋' },
    { path: '/admin/calendar', label: 'Calendario', icon: '📅' },
    { path: '/admin/clients', label: 'Clientes', icon: '👥' },
    { path: '/admin/equipment', label: 'Equipos', icon: '⚙️' },
    { path: '/admin/services', label: 'Servicios', icon: '🔩' },
    { path: '/admin/service-categories', label: 'Categorías', icon: '🏷️' },
    { path: '/admin/service-types', label: 'Tipos de Servicio', icon: '📑' },
    { path: '/admin/locations', label: 'Ubicaciones', icon: '📍' },
    { path: '/admin/components', label: 'Componentes', icon: '🧩' },
    { path: '/admin/technicians', label: 'Técnicos', icon: '🔧' },
    { path: '/admin/users', label: 'Usuarios', icon: '👤' },
    { path: '/admin/activity-log', label: 'Bitácora', icon: '📝' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <div className="header-logo-title">
          <img src="/cigsa.png" alt="CIGSA Logo" className="header-logo" />
          <h1>CIGSA - Administración</h1>
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

