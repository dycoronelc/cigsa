import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [showPassword, setShowPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPassword2, setResetPassword2] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPassword2, setShowResetPassword2] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await login(username, password);
    
    if (result.success) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/technician/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!resetUsername || !resetEmail || !resetPassword || !resetPassword2) {
      setError('Completa todos los campos');
      return;
    }
    if (resetPassword !== resetPassword2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (resetPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        username: resetUsername,
        email: resetEmail,
        newPassword: resetPassword
      });
      setSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
      setMode('login');
      setResetUsername('');
      setResetEmail('');
      setResetPassword('');
      setResetPassword2('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ open }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open ? (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a21.77 21.77 0 0 1 5.06-6.94" />
          <path d="M1 1l22 22" />
          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a21.77 21.77 0 0 1-3.07 4.67" />
          <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
          <path d="M9.88 9.88A3 3 0 0 1 14.12 14.12" />
        </>
      )}
    </svg>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/cigsa.png" alt="CIGSA Logo" className="login-logo" />
          <h1>CIGSA</h1>
          <p>Sistema de Gestión de Órdenes</p>
        </div>
        
        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
          
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  title={showPassword ? 'Ocultar' : 'Ver'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            <button
              type="button"
              className="forgot-link"
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
            >
              ¿Olvidó su contraseña?
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <div className="reset-header">
              <h2>Restablecer contraseña</h2>
              <p>Ingrese su usuario y correo, y defina una nueva contraseña.</p>
            </div>

            <div className="form-group">
              <label htmlFor="reset-username">Usuario</label>
              <input
                type="text"
                id="reset-username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reset-email">Correo</label>
              <input
                type="email"
                id="reset-email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reset-password">Nueva contraseña</label>
              <div className="password-wrapper">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  id="reset-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowResetPassword((v) => !v)}
                  aria-label={showResetPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  title={showResetPassword ? 'Ocultar' : 'Ver'}
                >
                  <EyeIcon open={showResetPassword} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reset-password2">Confirmar contraseña</label>
              <div className="password-wrapper">
                <input
                  type={showResetPassword2 ? 'text' : 'password'}
                  id="reset-password2"
                  value={resetPassword2}
                  onChange={(e) => setResetPassword2(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowResetPassword2((v) => !v)}
                  aria-label={showResetPassword2 ? 'Ocultar contraseña' : 'Ver contraseña'}
                  title={showResetPassword2 ? 'Ocultar' : 'Ver'}
                >
                  <EyeIcon open={showResetPassword2} />
                </button>
              </div>
            </div>
          
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>

            <button
              type="button"
              className="forgot-link"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              Volver a iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

