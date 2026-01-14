import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import '../admin/Calendar.css';

moment.locale('es');
const localizer = momentLocalizer(moment);

export default function TechnicianCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: ''
  });
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [filters, user]);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/work-orders');
      // Filtrar solo las órdenes asignadas al técnico actual
      let filteredOrders = response.data.filter(
        order => order.assigned_technician_id === user.id
      );

      // Aplicar filtro de estado si existe
      if (filters.status) {
        filteredOrders = filteredOrders.filter(
          order => order.status === filters.status
        );
      }

      setOrders(filteredOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      created: '#9ca3af',      // Gris
      assigned: '#3b82f6',     // Azul
      in_progress: '#f59e0b',  // Amarillo/Naranja
      completed: '#10b981',    // Verde
      accepted: '#8b5cf6'       // Púrpura
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      created: 'Creada',
      assigned: 'Asignada',
      in_progress: 'En Proceso',
      completed: 'Completada',
      accepted: 'Aceptada'
    };
    return labels[status] || status;
  };

  const events = orders.map(order => {
    // Usar scheduled_date si existe, sino usar created_at
    let startDate;
    if (order.scheduled_date) {
      // Parsear la fecha correctamente usando moment
      // scheduled_date viene como string 'YYYY-MM-DD' desde MySQL
      try {
        const dateStr = typeof order.scheduled_date === 'string' 
          ? order.scheduled_date.split('T')[0] // Tomar solo la parte de fecha si viene con hora
          : moment(order.scheduled_date).format('YYYY-MM-DD');
        startDate = moment(dateStr, 'YYYY-MM-DD').startOf('day').toDate();
        
        // Validar que la fecha sea válida
        if (!moment(startDate).isValid()) {
          startDate = moment(order.created_at).startOf('day').toDate();
        }
      } catch (error) {
        startDate = moment(order.created_at).startOf('day').toDate();
      }
    } else {
      startDate = moment(order.created_at).startOf('day').toDate();
    }
    
    // Si tiene completion_date, usar ese como fin, sino agregar 1 día
    let endDate;
    if (order.completion_date) {
      endDate = moment(order.completion_date).endOf('day').toDate();
    } else if (order.start_date) {
      // Si está en proceso, usar start_date + 1 día
      endDate = moment(order.start_date).add(1, 'day').endOf('day').toDate();
    } else {
      // Si no tiene fecha de inicio ni completación, usar startDate + 1 día
      endDate = moment(startDate).add(1, 'day').endOf('day').toDate();
    }

    // Asegurar que endDate sea después de startDate
    if (endDate <= startDate) {
      endDate = moment(startDate).add(1, 'day').endOf('day').toDate();
    }

    // Limitar el título para que no sea muy largo
    const shortTitle = order.title.length > 30 
      ? order.title.substring(0, 30) + '...' 
      : order.title;

    return {
      id: order.id,
      title: `${order.order_number}: ${shortTitle}`,
      start: startDate,
      end: endDate,
      resource: {
        order,
        status: order.status,
        color: getStatusColor(order.status),
        client: order.client_name,
        equipment: order.equipment_name
      }
    };
  });

  const eventStyleGetter = (event) => {
    const backgroundColor = event.resource.color;
    const borderColor = event.resource.color;
    
    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth: '2px',
        borderRadius: '4px',
        color: '#fff',
        padding: '2px 4px',
        fontSize: '0.875rem',
        fontWeight: '500'
      }
    };
  };

  const handleSelectEvent = (event) => {
    navigate(`/technician/work-orders/${event.id}`);
  };

  const handleNavigate = (date) => {
    setCurrentDate(date);
  };

  if (loading) {
    return <div className="loading">Cargando calendario...</div>;
  }

  // Obtener estados únicos de las órdenes del técnico
  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'created', label: 'Creada' },
    { value: 'assigned', label: 'Asignada' },
    { value: 'in_progress', label: 'En Proceso' },
    { value: 'completed', label: 'Completada' },
    { value: 'accepted', label: 'Aceptada' }
  ];

  // Filtrar solo los estados que realmente tienen órdenes
  const availableStatuses = statusOptions.filter(status => {
    if (!status.value) return true;
    return orders.some(order => order.status === status.value);
  });

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Mi Calendario de Órdenes</h1>
        <div className="calendar-filters">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="filter-select"
          >
            {availableStatuses.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="calendar-legend">
        <div className="legend-title">Leyenda de Estados:</div>
        <div className="legend-items">
          {['created', 'assigned', 'in_progress', 'completed', 'accepted'].map(status => {
            const count = orders.filter(o => o.status === status).length;
            if (count === 0) return null;
            return (
              <div key={status} className="legend-item">
                <span 
                  className="legend-color" 
                  style={{ backgroundColor: getStatusColor(status) }}
                ></span>
                <span>{getStatusLabel(status)} ({count})</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}
          onSelectEvent={handleSelectEvent}
          onNavigate={handleNavigate}
          date={currentDate}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
          messages={{
            next: 'Siguiente',
            previous: 'Anterior',
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            agenda: 'Agenda',
            date: 'Fecha',
            time: 'Hora',
            event: 'Evento',
            noEventsInRange: 'No hay órdenes en este rango de fechas'
          }}
          popup
          showMultiDayTimes
          step={60}
          timeslots={1}
        />
      </div>
    </div>
  );
}

