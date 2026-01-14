import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../../services/api';
import './Calendar.css';

moment.locale('es');
const localizer = momentLocalizer(moment);

export default function CalendarView() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    technicianId: '',
    status: ''
  });
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchData = async () => {
    try {
      const [ordersRes, techniciansRes] = await Promise.all([
        api.get('/work-orders'),
        api.get('/technicians')
      ]);
      setOrders(ordersRes.data);
      setTechnicians(techniciansRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get('/work-orders');
      let filteredOrders = response.data;

      if (filters.technicianId) {
        filteredOrders = filteredOrders.filter(
          order => order.assigned_technician_id && order.assigned_technician_id === parseInt(filters.technicianId)
        );
      }

      if (filters.status) {
        filteredOrders = filteredOrders.filter(
          order => order.status === filters.status
        );
      }

      setOrders(filteredOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
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
        technician: order.technician_name || 'Sin asignar',
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
    navigate(`/admin/work-orders/${event.id}`);
  };

  const handleNavigate = (date) => {
    setCurrentDate(date);
  };

  if (loading) {
    return <div className="loading">Cargando calendario...</div>;
  }

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Calendario de Órdenes de Trabajo</h1>
        <div className="calendar-filters">
          <select
            value={filters.technicianId}
            onChange={(e) => setFilters({ ...filters, technicianId: e.target.value })}
            className="filter-select"
          >
            <option value="">Todos los técnicos</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>
                {tech.full_name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="filter-select"
          >
            <option value="">Todos los estados</option>
            <option value="created">Creada</option>
            <option value="assigned">Asignada</option>
            <option value="in_progress">En Proceso</option>
            <option value="completed">Completada</option>
            <option value="accepted">Aceptada</option>
          </select>
        </div>
      </div>

      <div className="calendar-legend">
        <div className="legend-title">Leyenda de Estados:</div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#9ca3af' }}></span>
            <span>Creada</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
            <span>Asignada</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
            <span>En Proceso</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#10b981' }}></span>
            <span>Completada</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#8b5cf6' }}></span>
            <span>Aceptada</span>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          onNavigate={handleNavigate}
          date={currentDate}
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

