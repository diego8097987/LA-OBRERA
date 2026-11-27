import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { BrandLogo } from './BrandLogo';
import { DesktopUpdateControls } from './UpdateBanner';

const PORTAL_LOGO_VIDEO_SRC = '/assets/aistudio/gemini_generated_video_7d3748c9_32df92bf.mp4';

const PortalVideoLogo: React.FC<{ className?: string }> = ({ className = 'w-28 h-28' }) => {
  const [videoError, setVideoError] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  if (videoError) {
    return <BrandLogo className={className} />;
  }

  return (
    <div
      className={`${className} relative rounded-full overflow-hidden bg-[#0e0c0b] border border-amber-500/35 shadow-lg shadow-orange-950/60 shrink-0`}
    >
      {/* Instant lightweight SVG logo renders at 0 ms while the MP4 decodes asynchronously */}
      {!videoReady && (
        <div className="absolute inset-0">
          <BrandLogo className="w-full h-full" />
        </div>
      )}
      <video
        src={PORTAL_LOGO_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        disablePictureInPicture
        aria-label="Logotipo animado LA OBRERA Grill Asadero"
        onCanPlay={() => setVideoReady(true)}
        onError={() => setVideoError(true)}
        className={`w-full h-full object-cover object-center pointer-events-none select-none transition-opacity duration-300 ${
          videoReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

type AuthFormMode = 'login' | 'register' | 'reset';

export const AuthGate: React.FC = () => {
  const {
    authReady,
    firebaseUser,
    needsEmailVerification,
    currentStaff,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    reloadEmailVerification,
    signInWithGoogle,
    exitSession,
    authError,
    clearAuthError,
    loadingData,
  } = usePos();

  const [formMode, setFormMode] = useState<AuthFormMode>('login');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (next: AuthFormMode) => {
    setFormMode(next);
    setInfoNotice(null);
    setLocalError(null);
    clearAuthError();
    setPassword('');
    setConfirmPassword('');
  };

  if (!authReady || loadingData) {
    return (
      <div className="min-h-screen bg-[#0e0c0b] flex flex-col items-center justify-center gap-4 p-6">
        <PortalVideoLogo className="w-28 h-28" />
        <p className="text-sm text-stone-400">Conectando con la base de datos de LA OBRERA...</p>
      </div>
    );
  }

  // Signed in with Email/Password, waiting for email verification
  if (firebaseUser && needsEmailVerification) {
    const handleCheckVerified = async () => {
      setSubmitting(true);
      setLocalError(null);
      setInfoNotice(null);
      try {
        const verified = await reloadEmailVerification();
        if (!verified) {
          setLocalError(
            'Tu correo aún aparece sin verificar. Abre el enlace que enviamos a tu bandeja de entrada y vuelve a intentar.'
          );
        }
      } finally {
        setSubmitting(false);
      }
    };

    const handleResend = async () => {
      setSubmitting(true);
      setLocalError(null);
      setInfoNotice(null);
      try {
        const res = await resendVerificationEmail();
        if (res.ok) {
          setInfoNotice(res.message);
        } else {
          setLocalError(res.message);
        }
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#0e0c0b] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#181412] border border-stone-800 rounded-xl p-8 text-center space-y-5">
          <div className="flex justify-center">
            <PortalVideoLogo className="w-28 h-28" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl uppercase tracking-wide text-white">
              Verifica tu Correo Electrónico
            </h1>
            <p className="text-sm text-stone-400 leading-relaxed">
              Enviamos un enlace de confirmación a{' '}
              <strong className="text-stone-200">{firebaseUser.email}</strong>. Por seguridad,
              debes confirmar tu correo antes de acceder a los pedidos y caja.
            </p>
          </div>

          {localError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200 text-left"
            >
              {localError}
            </div>
          )}

          {infoNotice && (
            <div
              role="status"
              className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-xs text-emerald-200 text-left flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoNotice}</span>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleCheckVerified()}
              className="w-full px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>Ya verifiqué mi correo · Entrar</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleResend()}
              className="w-full px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-60 text-stone-100 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Reenviar enlace de verificación</span>
            </button>

            <button
              type="button"
              onClick={() => void exitSession()}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-800 hover:bg-stone-900 text-stone-400 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in & verified, but pending admin approval or deactivated
  if (firebaseUser && currentStaff && (!currentStaff.active || currentStaff.role === 'pending')) {
    return (
      <div className="min-h-screen bg-[#0e0c0b] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#181412] border border-stone-800 rounded-xl p-8 text-center space-y-5">
          <div className="flex justify-center">
            <PortalVideoLogo className="w-28 h-28" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl uppercase tracking-wide text-white">
              Cuenta Pendiente de Autorización
            </h1>
            <p className="text-sm text-stone-400 leading-relaxed">
              Tu cuenta <strong className="text-stone-200">{firebaseUser.email}</strong> está
              verificada, pero por seguridad un Administrador debe asignarte un perfil operativo
              (Mesero, Cocina, Cajero o Administrador) antes de acceder a los pedidos y ventas.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-amber-400 py-2 border-y border-stone-800">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Acceso restringido · Sin lectura de datos mientras está pendiente</span>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void exitSession()}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-800 hover:bg-stone-900 text-stone-300 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoNotice(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoNotice(null);
    setSubmitting(true);
    try {
      const ok = await registerWithEmail(displayName, email, password, confirmPassword);
      if (ok) {
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoNotice(null);
    setSubmitting(true);
    try {
      const res = await sendPasswordReset(email);
      if (res.ok) {
        setInfoNotice(res.message);
      } else {
        setLocalError(res.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const visibleError = localError || authError;

  return (
    <div className="flex-1 min-h-full bg-[#0e0c0b] text-[#f5efe6] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full border border-stone-800 rounded-2xl overflow-hidden bg-[#161210] shadow-2xl">
        {/* Animated Video Brand Header */}
        <div className="px-7 pt-7 pb-5 flex flex-col items-center justify-center gap-3 text-center bg-[#120f0d] border-b border-stone-800">
          <PortalVideoLogo className="w-32 h-32" />
          <div>
            <h1 className="font-display font-bold text-2xl tracking-wider text-white leading-tight">
              LA OBRERA
            </h1>
            <p className="text-xs text-amber-400 tracking-wide mt-0.5">
              Grill Asadero · Desde 1996
            </p>
          </div>
        </div>

        {/* Email & Password Auth Panel */}
        <div className="p-7 sm:p-8 flex flex-col justify-center space-y-5">
          {/* Mode Tabs */}
          {formMode !== 'reset' ? (
            <div
              role="tablist"
              aria-label="Modo de acceso"
              className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0e0c0b] border border-stone-800"
            >
              <button
                type="button"
                role="tab"
                aria-selected={formMode === 'login'}
                onClick={() => switchMode('login')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formMode === 'login'
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Iniciar Sesión</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={formMode === 'register'}
                onClick={() => switchMode('register')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formMode === 'register'
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Solicitar Acceso</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-400">Recuperación de Acceso</p>
              <h3 className="font-heading text-2xl uppercase tracking-wide text-white">
                Restablecer Contraseña
              </h3>
            </div>
          )}

          {visibleError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200 leading-relaxed"
            >
              {visibleError}
            </div>
          )}

          {infoNotice && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-xs text-emerald-200 leading-relaxed flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoNotice}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {formMode === 'login' && (
            <form onSubmit={(e) => void handleLoginSubmit(e)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="auth-login-email" className="block text-xs font-medium text-stone-300">
                  Correo electrónico del personal
                </label>
                <input
                  id="auth-login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mesero@laobrera.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="auth-login-password"
                    className="block text-xs font-medium text-stone-300"
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="auth-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>{submitting ? 'Verificando acceso...' : 'Entrar con Correo y Contraseña'}</span>
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {formMode === 'register' && (
            <form onSubmit={(e) => void handleRegisterSubmit(e)} noValidate className="space-y-3.5">
              <div className="space-y-1">
                <label htmlFor="auth-reg-name" className="block text-xs font-medium text-stone-300">
                  Nombre completo
                </label>
                <input
                  id="auth-reg-name"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej. Carlos Ramírez"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="auth-reg-email" className="block text-xs font-medium text-stone-300">
                  Correo electrónico
                </label>
                <input
                  id="auth-reg-email"
                  type="email"
                  autoComplete="email"
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="empleado@laobrera.com"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="auth-reg-password"
                    className="block text-xs font-medium text-stone-300"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="auth-reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mín. 8 caracteres"
                      className="w-full pl-3.5 pr-9 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="auth-reg-confirm"
                    className="block text-xs font-medium text-stone-300"
                  >
                    Confirmar contraseña
                  </label>
                  <input
                    id="auth-reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite contraseña"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[11px] text-stone-400">
                Solo el Administrador autoriza el ingreso y asigna el rol (Mesero, Cocina, Cajero o
                Administrador). Tu cuenta quedará bloqueada hasta ser aprobada.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>{submitting ? 'Enviando solicitud...' : 'Enviar Solicitud de Cuenta'}</span>
              </button>
            </form>
          )}

          {/* PASSWORD RESET FORM */}
          {formMode === 'reset' && (
            <form onSubmit={(e) => void handleResetSubmit(e)} noValidate className="space-y-4">
              <p className="text-xs text-stone-400 leading-relaxed">
                Ingresa tu correo registrado y te enviaremos un enlace seguro para crear una nueva
                contraseña.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="auth-reset-email" className="block text-xs font-medium text-stone-300">
                  Correo electrónico
                </label>
                <input
                  id="auth-reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mesero@laobrera.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {submitting ? 'Enviando...' : 'Enviar Enlace'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition cursor-pointer"
                >
                  Volver
                </button>
              </div>
            </form>
          )}

          {/* Secondary option */}
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="h-px flex-1 bg-stone-800" />
            <span>o continuar con Google</span>
            <span className="h-px flex-1 bg-stone-800" />
          </div>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="w-full px-4 py-2.5 rounded-lg bg-[#0e0c0b] hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Entrar con Google</span>
          </button>

          <div className="pt-1 flex justify-center">
            <DesktopUpdateControls variant="login" />
          </div>
        </div>
      </div>
    </div>
  );
};
