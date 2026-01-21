import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import TechnicianLayout from './layouts/TechnicianLayout';
import Dashboard from './pages/admin/Dashboard';
import Clients from './pages/admin/Clients';
import Equipment from './pages/admin/Equipment';
import Services from './pages/admin/Services';
import Technicians from './pages/admin/Technicians';
import Users from './pages/admin/Users';
import WorkOrders from './pages/admin/WorkOrders';
import WorkOrderNew from './pages/admin/WorkOrderNew';
import WorkOrderDetail from './pages/admin/WorkOrderDetail';
import Calendar from './pages/admin/Calendar';
import ActivityLog from './pages/admin/ActivityLog';
import ServiceDetail from './pages/admin/ServiceDetail';
import ServiceCategories from './pages/admin/ServiceCategories';
import TechnicianDashboard from './pages/technician/Dashboard';
import TechnicianWorkOrders from './pages/technician/WorkOrders';
import TechnicianWorkOrderDetail from './pages/technician/WorkOrderDetail';
import TechnicianCalendar from './pages/technician/Calendar';

function PrivateRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/technician/dashboard'} />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  if (user.role === 'admin') {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/clients" element={<Clients />} />
          <Route path="/admin/equipment" element={<Equipment />} />
          <Route path="/admin/services" element={<Services />} />
          <Route path="/admin/technicians" element={<Technicians />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/work-orders" element={<WorkOrders />} />
          <Route path="/admin/work-orders/new" element={<WorkOrderNew />} />
          <Route path="/admin/work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="/admin/calendar" element={<Calendar />} />
          <Route path="/admin/activity-log" element={<ActivityLog />} />
          <Route path="/admin/services/:id" element={<ServiceDetail />} />
          <Route path="/admin/service-categories" element={<ServiceCategories />} />
          <Route path="/login" element={<Navigate to="/admin/dashboard" />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" />} />
        </Routes>
      </AdminLayout>
    );
  }

  return (
    <TechnicianLayout>
      <Routes>
        <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
        <Route path="/technician/work-orders" element={<TechnicianWorkOrders />} />
        <Route path="/technician/work-orders/:id" element={<TechnicianWorkOrderDetail />} />
        <Route path="/technician/calendar" element={<TechnicianCalendar />} />
        <Route path="/login" element={<Navigate to="/technician/dashboard" />} />
        <Route path="*" element={<Navigate to="/technician/dashboard" />} />
      </Routes>
    </TechnicianLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;

