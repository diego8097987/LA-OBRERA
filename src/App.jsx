import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  Flame,
  Users,
  DollarSign,
  Utensils,
  ChefHat,
  Bell,
  BellOff,
  PlusCircle,
  Unlock,
  CheckCircle2,
  Printer,
  Search,
  Wifi,
  Eye,
  EyeOff,
  Smartphone,
  FileSpreadsheet,
  KeyRound,
  Banknote,
  AlertTriangle,
  Layers,
  Database,
  LogOut,
  X,
  MessageSquarePlus,
  MapPin,
  Globe
} from 'lucide-react';

// ============================================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE CLOUD FIRESTORE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBPpoQRwpCT6Bujmedjf_cKbQ5MHr_-3qA",
  authDomain: "la-obrera-grill-asadero.firebaseapp.com",
  databaseURL: "https://la-obrera-grill-asadero-default-rtdb.firebaseio.com",
  projectId: "la-obrera-grill-asadero",
  storageBucket: "la-obrera-grill-asadero.firebasestorage.app",
  messagingSenderId: "70400011774",
  appId: "1:70400011774:web:8eb06133ae8b9df5b324af",
  measurementId: "G-ER3EHSNGHX"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' && __app_id ? __app_id : 'la-obrera-grill-cloud-v1';

const MAX_USERS_LIMIT = 50;

// ============================================================================
// 2. CATÁLOGO OFICIAL COMPLETO DE "LA OBRERA GRILL ASADERO"
// ============================================================================
const MENU_CATALOG = [
  {
    id: 'familiar',
    title: 'FAMILIAR',
    items: [
      { id: 'fam-1', name: 'Pollo Familiar', price: 240 },
      { id: 'fam-2', name: 'Costilla Familiar', price: 290 },
      { id: 'fam-3', name: 'Conejo Familiar', price: 490 },
      { id: 'fam-4', name: '1 kg. Chorizo Argentino', price: 420 },
      { id: 'fam-5', name: '1 kg. Arrachera', price: 430 },
      { id: 'fam-6', name: '1 kg. Chistorra', price: 370 }
    ]
  },
  {
    id: 'cortes',
    title: 'CORTES DE CARNE',
    items: [
      { id: 'cor-1', name: 'Ryb-Eye', price: 300 },
      { id: 'cor-2', name: 'New York', price: 300 },
      { id: 'cor-3', name: 'T-Bone', price: 300 },
      { id: 'cor-4', name: 'Tomahawk', price: 610 }
    ]
  },
  {
    id: 'compartir',
    title: 'PARA COMPARTIR',
    items: [
      { id: 'com-1', name: 'Pollo 1/2', price: 135 },
      { id: 'com-2', name: 'Conejo 1/2', price: 275 },
      { id: 'com-3', name: 'Arrachera (500grs)', price: 225 },
      { id: 'com-4', name: 'Chistorra Compartir', price: 185 },
      { id: 'com-5', name: 'Chorizo Argentino (4pz)', price: 215 },
      { id: 'com-6', name: 'Costilla Compartir', price: 165 }
    ]
  },
  {
    id: 'parrillada',
    title: 'PARRILLADA MIXTA',
    items: [
      { id: 'par-1', name: 'Parrillada Mixta Grande', price: 1650 },
      { id: 'par-2', name: 'Parrillada Mixta Mediana', price: 900 },
      { id: 'par-3', name: 'Parrillada Mixta Chica', price: 600 }
    ]
  },
  {
    id: 'individual',
    title: 'INDIVIDUAL',
    items: [
      { id: 'ind-1', name: 'Pollo 1/4', price: 110 },
      { id: 'ind-2', name: 'Arrachera (300grs)', price: 130 },
      { id: 'ind-3', name: 'Chistorra Individual', price: 110 },
      { id: 'ind-4', name: 'Costilla Individual', price: 110 },
      { id: 'ind-5', name: 'Chorizo Argentino (2pz)', price: 120 }
    ]
  },
  {
    id: 'mixotes',
    title: 'MIXOTES',
    items: [
      { id: 'mix-1', name: 'Mixote de Carnero', price: 130 },
      { id: 'mix-2', name: 'Mixote de Conejo', price: 130 },
      { id: 'mix-3', name: 'Mixote de Costilla', price: 110 },
      { id: 'mix-4', name: 'Mixote de Pollo', price: 110 }
    ]
  },
  {
    id: 'extras',
    title: 'EXTRAS Y ENTRADAS',
    items: [
      { id: 'ext-1', name: 'Nopales', price: 35 },
      { id: 'ext-2', name: 'Ensalada Chica', price: 50 },
      { id: 'ext-3', name: 'Ensalada Grande', price: 75 },
      { id: 'ext-4', name: 'Queso Fundido Chico', price: 60 },
      { id: 'ext-5', name: 'Queso Fundido Grande', price: 80 },
      { id: 'ext-6', name: 'Aderezo', price: 25 },
      { id: 'ext-7', name: 'Jalapeños Grill (3PZ)', price: 90 },
      { id: 'ext-8', name: 'Jalapeños Grill (1PZ)', price: 35 },
      { id: 'ext-9', name: 'Papas Grill', price: 90 },
      { id: 'ext-10', name: 'Papa Especial', price: 160 }
    ]
  },
  {
    id: 'bebidas',
    title: 'BEBIDAS',
    items: [
      { id: 'beb-1', name: 'Horchata con Nuez', price: 45 },
      { id: 'beb-2', name: 'Tamarindo', price: 45 },
      { id: 'beb-3', name: 'Jamaica', price: 45 },
      { id: 'beb-4', name: 'Cítricos', price: 45 },
      { id: 'beb-5', name: 'Sangría Preparada', price: 65 },
      { id: 'beb-6', name: 'Tehuacán Preparado', price: 65 },
      { id: 'beb-7', name: 'Michelada Cubana', price: 110 },
      { id: 'beb-8', name: 'Michelada Sal y Limón', price: 100 }
    ]
  }
];

const findDishById = (itemId) => {
  for (const cat of MENU_CATALOG) {
    const found = cat.items.find((i) => i.id === itemId);
    if (found) return { ...found, categoryTitle: cat.title };
  }
  return null;
};

// ============================================================================
// 3. USUARIOS Y CONTRASEÑAS SEMILLA EN FIRESTORE
// ============================================================================
const DEFAULT_CLOUD_USERS = [
  {
    userId: 'user_master_admin',
    fullName: 'Administrador Principal',
    role: 'Administrador',
    initialPassword: 'ADMIN1234',
    password: 'ADMIN1234',
    createdAtMs: 1700000001000,
    isMasterAdmin: true
  },
  {
    userId: 'user_mesero_1',
    fullName: 'Mesero Turno 1 (Pedidos y Cobro)',
    role: 'Mesero',
    initialPassword: 'MESERO1234',
    password: 'MESERO1234',
    createdAtMs: 1700000002000,
    isMasterAdmin: false
  },
  {
    userId: 'user_cocina_1',
    fullName: 'Maestro Parrillero (Cocina)',
    role: 'Cocina',
    initialPassword: 'BRASAS1234',
    password: 'BRASAS1234',
    createdAtMs: 1700000003000,
    isMasterAdmin: false
  },
  {
    userId: 'user_cajero_1',
    fullName: 'Cajero Principal (Caja)',
    role: 'Cajero',
    initialPassword: 'CAJA1234',
    password: 'CAJA1234',
    createdAtMs: 1700000004000,
    isMasterAdmin: false
  }
];

// ============================================================================
// 4. LOGOTIPO OFICIAL SVG
// ============================================================================
const OfficialLogoSVG = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 400 400" className={className}>
    <defs>
      <radialGradient id="fireBgGradReact" cx="50%" cy="60%" r="55%">
        <stop offset="0%" stopColor="#ff9900" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#cc3300" stopOpacity="0.75" />
        <stop offset="80%" stopColor="#4a0e00" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#0d0502" stopOpacity="1" />
      </radialGradient>
      <linearGradient id="flameFillGradReact" x1="0%" y1="100%" x2="10%" y2="0%">
        <stop offset="0%" stopColor="#e65c00" />
        <stop offset="55%" stopColor="#ff9914" />
        <stop offset="100%" stopColor="#ffcc33" />
      </linearGradient>
      <linearGradient id="grillYellowGradReact" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffd000" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
      <path id="asaderoCurveReact" d="M 102,292 A 118,118 0 0,0 298,292" />
    </defs>
    <circle cx="200" cy="200" r="196" fill="url(#fireBgGradReact)" />
    <circle cx="200" cy="242" r="118" fill="#050505" stroke="#ffffff" strokeWidth="11" />
    <clipPath id="grillClipReact">
      <circle cx="200" cy="242" r="82" />
    </clipPath>
    <g clipPath="url(#grillClipReact)" fill="url(#grillYellowGradReact)">
      <rect x="110" y="242" width="180" height="10" rx="3" />
      <rect x="110" y="258" width="180" height="10" rx="3" />
      <rect x="110" y="274" width="180" height="10" rx="3" />
      <rect x="110" y="290" width="180" height="10" rx="3" />
      <rect x="110" y="306" width="180" height="10" rx="3" />
    </g>
    <path
      d="M 96,190 C 94,148 130,120 150,88 C 157,75 151,57 146,48 C 167,55 182,80 179,105 C 194,68 230,36 268,22 C 258,50 238,76 234,108 C 250,99 262,95 275,98 C 256,118 250,144 256,190 Z"
      fill="url(#flameFillGradReact)"
      stroke="#ffffff"
      strokeWidth="6"
    />
    <rect x="30" y="182" width="340" height="66" rx="10" fill="#050505" stroke="#ffffff" strokeWidth="9" />
    <text
      x="198"
      y="224"
      textAnchor="middle"
      fill="#ffffff"
      fontFamily="serif"
      fontWeight="900"
      fontSize="31"
      letterSpacing="2.5"
    >
      LA OBRERA
    </text>
    <text
      x="315"
      y="240"
      textAnchor="end"
      fill="#e5e5e5"
      fontFamily="sans-serif"
      fontWeight="700"
      fontSize="7.5"
    >
      DESDE 1996
    </text>
    <g transform="translate(202, 286) rotate(-14)">
      <text
        x="0"
        y="0"
        textAnchor="middle"
        fill="#ffffff"
        stroke="#050505"
        strokeWidth="6"
        paintOrder="stroke"
        fontFamily="cursive"
        fontWeight="700"
        fontSize="52"
      >
        Grill
      </text>
    </g>
    <text
      fill="#ffffff"
      fontFamily="serif"
      fontWeight="900"
      fontSize="24"
      letterSpacing="2"
    >
      <textPath href="#asaderoCurveReact" startOffset="50%" textAnchor="middle">
        ASADERO
      </textPath>
    </text>
  </svg>
);

// ============================================================================
// 5. SINTETIZADOR DE CAMPANA DE COCINA
// ============================================================================
const playKitchenSound = (enabled, type = 'new') => {
  if (!enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    if (type === 'new') {
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1174.66, now + 0.16);
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(587.33, now + 0.16);
    } else if (type === 'ready') {
      osc1.frequency.setValueAtTime(987.77, now);
      osc1.frequency.setValueAtTime(1318.51, now + 0.18);
      osc2.frequency.setValueAtTime(493.88, now);
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
    } else {
      osc1.frequency.setValueAtTime(659.25, now);
      osc2.frequency.setValueAtTime(329.63, now);
    }

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
  } catch (err) {}
};

// ============================================================================
// 6. COMPONENTE SUBCOMPONENTE GUÍA MULTI-DISPOSITIVO
// ============================================================================
function SyncGuideModal({ branchCode, cloudConnected, appId, onClose }) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#14110f] border-2 border-sky-500/60 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-sky-400" />
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold uppercase text-white">
                Enlace Cloud Multi-Dispositivo (Web + Monitor)
              </h3>
              <p className="text-xs text-emerald-400 font-mono">
                Estado Actual: {cloudConnected ? '☁️ CONECTADO A FIRESTORE' : 'CONECTANDO...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-stone-200 leading-relaxed">
          <div className="bg-[#090807] border border-stone-800 rounded-2xl p-4 space-y-2">
            <p className="text-xs text-stone-300">
              1. Los clientes hacen su pedido en la <strong>Página Web (`index.html`)</strong>.<br />
              2. El pedido se guarda automáticamente en <strong>Firebase Firestore</strong> (`la_obrera_orders`).<br />
              3. Este <strong>Monitor POS</strong> detecta el pedido al instante con `onSnapshot`, hace sonar la campana de cocina y lo muestra en pantalla.<br />
              4. Todas las <strong>contraseñas y usuarios</strong> se guardan automáticamente en Firestore (`master_directory` y colección `la_obrera_users`).
            </p>
          </div>

          <div className="bg-[#090807] border border-stone-800 rounded-2xl p-3 flex items-center justify-between text-xs font-mono">
            <span className="text-stone-400">ID de Base de Datos Firestore:</span>
            <span className="text-emerald-400 font-bold">{appId} ({branchCode})</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase text-xs tracking-wider"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 7. COMPONENTE PRINCIPAL DE LA APLICACIÓN EN REACT
// ============================================================================
export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('--:--:--');
  const [branchCode] = useState('LA-OBRERA-MATRIZ');

  const [usersList, setUsersList] = useState(DEFAULT_CLOUD_USERS);
  const [ordersList, setOrdersList] = useState([]);
  const [cashShift, setCashShift] = useState({
    isOpen: true,
    shiftId: 'shift_active',
    openedAtMs: Date.now(),
    openedBy: 'Administrador Principal',
    initialFund: 500,
    notes: 'Turno Activo Sincronizado',
    lastWipedAtMs: 0
  });

  const [loggedOperator, setLoggedOperator] = useState(null);
  const [selectedLoginUserId, setSelectedLoginUserId] = useState(DEFAULT_CLOUD_USERS[0].userId);
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('kds');
  const [statusFilter, setStatusFilter] = useState('activos');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wallClock, setWallClock] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const [showPosModal, setShowPosModal] = useState(false);
  const [editingOrderForAppend, setEditingOrderForAppend] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppRawText, setWhatsAppRawText] = useState('');
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSyncGuideModal, setShowSyncGuideModal] = useState(false);
  const [ticketModalOrder, setTicketModalOrder] = useState(null);
  const [chargeModalOrder, setChargeModalOrder] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashReceivedInput, setCashReceivedInput] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Mesero');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editingUserMap, setEditingUserMap] = useState({});

  const [openCashFundInput, setOpenCashFundInput] = useState('500');
  const [openCashNotesInput, setOpenCashNotesInput] = useState('');

  const [posCategory, setPosCategory] = useState('todos');
  const [posSearch, setPosSearch] = useState('');
  const [posServiceType, setPosServiceType] = useState('Mesa 1');
  const [posDelStreet, setPosDelStreet] = useState('');
  const [posDelColony, setPosDelColony] = useState('');
  const [posDelRef, setPosDelRef] = useState('');
  const [posNotes, setPosNotes] = useState('');
  const [posNewDinerName, setPosNewDinerName] = useState('');
  const [posDiners, setPosDiners] = useState([
    { id: 'diner-1', fullName: 'Comensal 1 (Titular)', isShared: false, cart: {} },
    { id: 'diner-shared', fullName: 'Al Centro / Compartido', isShared: true, cart: {} }
  ]);
  const [posActiveDinerId, setPosActiveDinerId] = useState('diner-1');

  const prevOrdersCountRef = useRef(0);

  const triggerToast = (msg) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const updateClock = () => {
      setWallClock(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth)
      .then((res) => {
        setFbUser(res.user);
      })
      .catch((err) => {
        console.warn('Aviso de autenticación Firebase (Fallback activo):', err?.message || err);
        setFbUser({ uid: 'local-fallback-user' });
      });
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;

    const masterDirRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'la_obrera_cloud_state',
      'master_directory'
    );
    const unsubMasterDir = onSnapshot(
      masterDirRef,
      async (docSnap) => {
        setCloudConnected(true);
        setLastSyncTime(
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );

        if (!docSnap.exists() || !docSnap.data()?.isInitialized) {
          await setDoc(
            masterDirRef,
            {
              isInitialized: true,
              usersJson: JSON.stringify(DEFAULT_CLOUD_USERS),
              updatedAtMs: Date.now()
            },
            { merge: true }
          );
          for (const u of DEFAULT_CLOUD_USERS) {
            await setDoc(
              doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_users', u.userId),
              u,
              { merge: true }
            );
          }
          setUsersList(DEFAULT_CLOUD_USERS);
          return;
        }

        const data = docSnap.data();
        let parsedUsers = [];
        if (typeof data.usersJson === 'string') {
          try {
            parsedUsers = JSON.parse(data.usersJson);
          } catch (e) {
            parsedUsers = [];
          }
        } else if (Array.isArray(data.users)) {
          parsedUsers = data.users;
        }

        const normalizedUsers = parsedUsers
          .filter((u) => u && u.userId)
          .map((u) => ({
            ...u,
            role: u.role === 'Parrillero / Cocina' ? 'Cocina' : u.role || 'Mesero',
            password: u.password || u.initialPassword || '1234',
            initialPassword: u.initialPassword || u.password || '1234'
          }));

        normalizedUsers.sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
        setUsersList(normalizedUsers);
      },
      (error) => {
        console.error('Error sincronizando directorio maestro:', error);
      }
    );

    const shiftDocRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'la_obrera_cash_shift',
      'current_shift'
    );
    const unsubShift = onSnapshot(
      shiftDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCashShift((prev) => ({ ...prev, ...data }));
        } else {
          const initialShift = {
            isOpen: true,
            shiftId: `shift_${Date.now()}`,
            openedAtMs: Date.now(),
            openedBy: 'Administrador Principal',
            initialFund: 500,
            notes: 'Turno Abierto en Nube',
            lastWipedAtMs: 0
          };
          await setDoc(shiftDocRef, initialShift, { merge: true });
        }
      },
      (error) => {
        console.error('Error sincronizando caja:', error);
      }
    );

    const ordersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'la_obrera_orders');
    const unsubOrders = onSnapshot(
      ordersColRef,
      (snapshot) => {
        setLastSyncTime(
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );

        const loadedOrders = [];
        snapshot.forEach((docSnap) => {
          const raw = docSnap.data();
          if (!raw) return;

          let parsedDiners = [];
          if (Array.isArray(raw.diners)) {
            parsedDiners = raw.diners;
          } else if (typeof raw.dinersJson === 'string') {
            try {
              parsedDiners = JSON.parse(raw.dinersJson);
            } catch (e) {
              parsedDiners = [];
            }
          }

          let parsedChecked = {};
          if (raw.checkedItemsMap && typeof raw.checkedItemsMap === 'object') {
            parsedChecked = raw.checkedItemsMap;
          } else if (typeof raw.checkedItemsJson === 'string') {
            try {
              parsedChecked = JSON.parse(raw.checkedItemsJson);
            } catch (e) {
              parsedChecked = {};
            }
          }

          loadedOrders.push({
            ...raw,
            orderDocId: docSnap.id,
            diners: parsedDiners,
            checkedItemsMap: parsedChecked
          });
        });

        loadedOrders.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

        if (loadedOrders.length > prevOrdersCountRef.current && prevOrdersCountRef.current > 0) {
          playKitchenSound(soundEnabled, 'new');
          const newest = loadedOrders[0];
          if (newest) {
            triggerToast(`🔔 ¡Nuevo Pedido #${newest.folio} (${newest.serviceType}) recibido en automático!`);
          }
        }
        prevOrdersCountRef.current = loadedOrders.length;
        setOrdersList(loadedOrders);
      },
      (error) => {
        console.error('Error sincronizando pedidos:', error);
      }
    );

    return () => {
      unsubMasterDir();
      unsubShift();
      unsubOrders();
    };
  }, [fbUser, soundEnabled]);

  useEffect(() => {
    if (!loggedOperator) return;
    const updatedSelf = usersList.find((u) => u.userId === loggedOperator.userId);
    if (!updatedSelf) {
      setLoggedOperator(null);
      triggerToast('🔒 Tu usuario fue dado de baja por el Administrador.');
      return;
    }
    if (
      updatedSelf.role !== loggedOperator.role ||
      updatedSelf.password !== loggedOperator.password ||
      updatedSelf.fullName !== loggedOperator.fullName
    ) {
      setLoggedOperator(updatedSelf);
    }
  }, [usersList, loggedOperator]);

  const rolePermissions = useMemo(() => {
    const role = loggedOperator?.role || '';
    const isAdmin = role === 'Administrador';
    const isMesero = role === 'Mesero';
    const isCocina = role === 'Cocina' || role === 'Parrillero / Cocina';
    const isCajero = role === 'Cajero';

    return {
      isAdmin,
      isMesero,
      isCocina,
      isCajero,
      canTakeOrders: isAdmin || isMesero || isCajero,
      canChargeOrders: isAdmin || isMesero || isCajero,
      canTrackKitchen: isAdmin || isCocina,
      canManageCashRegister: isAdmin,
      canManageUsers: isAdmin
    };
  }, [loggedOperator]);

  const kpiMetrics = useMemo(() => {
    const activeCount = ordersList.filter((o) => o.status !== 'pagado').length;
    const newCount = ordersList.filter((o) => o.status === 'recibido').length;
    const grillCount = ordersList.filter(
      (o) => o.status === 'en_parrilla' || o.status === 'en_brasas'
    ).length;
    const readyCount = ordersList.filter(
      (o) => o.status === 'pronto_en_mesa' || o.status === 'listo'
    ).length;
    const totalDiners = ordersList.reduce((acc, o) => acc + (Number(o.dinersCount) || 1), 0);
    const totalSalesDay = ordersList.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
    const totalPaidMoney = ordersList
      .filter((o) => o.status === 'pagado')
      .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

    return {
      activeCount,
      newCount,
      grillCount,
      readyCount,
      totalDiners,
      totalSalesDay,
      totalPaidMoney
    };
  }, [ordersList]);

  const grillAggregatedItems = useMemo(() => {
    const map = new Map();
    let totalPiecesPending = 0;

    ordersList
      .filter((o) => o.status !== 'pagado')
      .forEach((order) => {
        (order.diners || []).forEach((diner) => {
          Object.entries(diner.cart || {}).forEach(([itemId, qty]) => {
            const checkKey = `${diner.id}_${itemId}`;
            const isDone = !!(order.checkedItemsMap && order.checkedItemsMap[checkKey]);
            if (isDone) return;

            const dish = findDishById(itemId);
            if (dish && qty > 0) {
              const current = map.get(itemId) || { dish, count: 0, tables: [] };
              current.count += Number(qty);
              const tableLabel = `${order.serviceType} (#${order.folio})`;
              if (!current.tables.includes(tableLabel)) {
                current.tables.push(tableLabel);
              }
              map.set(itemId, current);
              totalPiecesPending += Number(qty);
            }
          });
        });
      });

    const items = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return { items, totalPiecesPending };
  }, [ordersList]);

  // Guarda todas las contraseñas y usuarios en Firestore (tanto en master_directory como en colección la_obrera_users)
  const saveMasterUsersDirectoryToCloud = async (nextUsersArray) => {
    setUsersList(nextUsersArray);
    if (fbUser && db) {
      const masterDirRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'la_obrera_cloud_state',
        'master_directory'
      );
      await setDoc(
        masterDirRef,
        {
          isInitialized: true,
          usersJson: JSON.stringify(nextUsersArray),
          updatedAtMs: Date.now()
        },
        { merge: true }
      );
      for (const u of nextUsersArray) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_users', u.userId),
          {
            ...u,
            updatedAtMs: Date.now()
          },
          { merge: true }
        );
      }
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const targetUser = usersList.find((u) => u.userId === selectedLoginUserId);
    if (!targetUser) {
      setLoginError('Selecciona un usuario válido de la lista.');
      return;
    }

    const cleanPass = loginPassword.trim();
    if (cleanPass !== targetUser.password && cleanPass !== targetUser.initialPassword) {
      setLoginError(`Contraseña incorrecta para ${targetUser.fullName}.`);
      return;
    }

    setLoginError('');
    setLoginPassword('');
    setLoggedOperator(targetUser);
    playKitchenSound(soundEnabled, 'status');
    triggerToast(`🔓 Sesión iniciada: ${targetUser.fullName} (${targetUser.role})`);
  };

  const handleCreateCloudUser = async (e) => {
    e.preventDefault();
    if (!rolePermissions.canManageUsers) return;
    if (usersList.length >= MAX_USERS_LIMIT) {
      triggerToast(`⚠️ Se alcanzó el límite máximo de ${MAX_USERS_LIMIT} usuarios.`);
      return;
    }

    const cleanName = newUserName.trim();
    const cleanPass = newUserPassword.trim();
    if (!cleanName || !cleanPass) {
      triggerToast('⚠️ Ingresa el nombre completo y la contraseña asignada.');
      return;
    }

    const newUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newUserDoc = {
      userId: newUserId,
      fullName: cleanName,
      role: newUserRole,
      initialPassword: cleanPass,
      password: cleanPass,
      createdAtMs: Date.now(),
      isMasterAdmin: false
    };

    try {
      const nextList = [...usersList, newUserDoc];
      await saveMasterUsersDirectoryToCloud(nextList);
      setNewUserName('');
      setNewUserPassword('');
      triggerToast(`☁️ Contraseña de "${cleanName}" guardada en Firestore.`);
    } catch (err) {
      console.error('Error guardando usuario:', err);
    }
  };

  const handleUpdateCloudUser = async (userObj) => {
    if (!rolePermissions.canManageUsers) return;
    const edits = editingUserMap[userObj.userId] || {};
    const updatedName =
      edits.fullName !== undefined ? edits.fullName.trim() : userObj.fullName;
    const updatedPassword =
      edits.password !== undefined ? edits.password.trim() : userObj.password;
    const updatedRole =
      edits.role !== undefined && !userObj.isMasterAdmin ? edits.role : userObj.role;

    if (!updatedPassword) {
      triggerToast('⚠️ La contraseña no puede quedar vacía.');
      return;
    }

    const updatedDoc = {
      ...userObj,
      fullName: updatedName || userObj.fullName,
      password: updatedPassword,
      initialPassword: updatedPassword,
      role: updatedRole,
      updatedAtMs: Date.now()
    };

    try {
      const nextList = usersList.map((u) => (u.userId === userObj.userId ? updatedDoc : u));
      await saveMasterUsersDirectoryToCloud(nextList);
      triggerToast(`☁️ Contraseña de "${updatedDoc.fullName}" guardada en Firestore.`);
    } catch (err) {
      console.error('Error actualizando usuario:', err);
    }
  };

  const handleDeleteCloudUser = async (userObj) => {
    if (!rolePermissions.canManageUsers || userObj.isMasterAdmin) return;
    try {
      const nextList = usersList.filter((u) => u.userId !== userObj.userId);
      await saveMasterUsersDirectoryToCloud(nextList);
      if (fbUser && db) {
        await deleteDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_users', userObj.userId)
        );
      }
      triggerToast(`🗑️ Usuario "${userObj.fullName}" eliminado de Firestore.`);
    } catch (err) {
      console.error('Error eliminando usuario:', err);
    }
  };

  const handleUpdateOrderStatus = async (order, nextStatus, paymentDetails = null) => {
    if (
      (nextStatus === 'en_parrilla' || nextStatus === 'pronto_en_mesa') &&
      !rolePermissions.canTrackKitchen
    ) {
      triggerToast('⛔ Tu rol solo da seguimiento o cobra según corresponda.');
      return;
    }
    if (nextStatus === 'pagado' && !rolePermissions.canChargeOrders) {
      triggerToast('⛔ Tu rol no tiene permisos de cobro.');
      return;
    }

    const updatedOrder = {
      ...order,
      status: nextStatus,
      updatedAtMs: Date.now(),
      lastUpdatedBy: loggedOperator ? `${loggedOperator.fullName} (${loggedOperator.role})` : '',
      ...(paymentDetails ? { paymentInfo: paymentDetails } : {})
    };

    try {
      if (fbUser && db) {
        const payload = {
          ...updatedOrder,
          dinersJson: JSON.stringify(updatedOrder.diners || []),
          checkedItemsJson: JSON.stringify(updatedOrder.checkedItemsMap || {})
        };
        delete payload.diners;
        delete payload.checkedItemsMap;

        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_orders', order.orderDocId),
          payload,
          { merge: true }
        );
      }
      triggerToast(`Folio #${order.folio} actualizado a: ${nextStatus}`);
    } catch (err) {
      console.error('Error actualizando estado:', err);
    }
  };

  const handleToggleDishCheck = async (order, checkKey) => {
    if (!rolePermissions.canTrackKitchen) return;
    const nextMap = { ...(order.checkedItemsMap || {}) };
    nextMap[checkKey] = !nextMap[checkKey];

    try {
      if (fbUser && db) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_orders', order.orderDocId),
          {
            checkedItemsJson: JSON.stringify(nextMap),
            updatedAtMs: Date.now()
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('Error tachando platillo:', err);
    }
  };

  const handleOpenPosCapture = (existingOrder = null) => {
    if (!rolePermissions.canTakeOrders) {
      triggerToast('⛔ Tu rol no puede tomar pedidos nuevos.');
      return;
    }
    if (!cashShift.isOpen) {
      triggerToast('⚠️ La Caja está cerrada.');
      return;
    }

    if (existingOrder) {
      setEditingOrderForAppend(existingOrder);
      setPosServiceType(existingOrder.serviceType || 'Mesa 1');
      setPosDelStreet(existingOrder.deliveryStreet || '');
      setPosDelColony(existingOrder.deliveryColony || '');
      setPosDelRef(existingOrder.deliveryReference || '');
      setPosNotes(existingOrder.notes || '');
      const clonedDiners =
        existingOrder.diners && existingOrder.diners.length > 0
          ? JSON.parse(JSON.stringify(existingOrder.diners))
          : [{ id: 'diner-1', fullName: 'Comensal 1', isShared: false, cart: {} }];
      setPosDiners(clonedDiners);
      setPosActiveDinerId(clonedDiners[0].id);
    } else {
      setEditingOrderForAppend(null);
      setPosServiceType('Mesa 1');
      setPosDelStreet('');
      setPosDelColony('');
      setPosDelRef('');
      setPosNotes('');
      setPosDiners([
        { id: 'diner-1', fullName: 'Comensal 1 (Titular)', isShared: false, cart: {} },
        { id: 'diner-shared', fullName: 'Al Centro / Compartido', isShared: true, cart: {} }
      ]);
      setPosActiveDinerId('diner-1');
    }

    setPosCategory('todos');
    setPosSearch('');
    setShowPosModal(true);
  };

  const handleAddDishToPosDiner = (itemId) => {
    setPosDiners((prev) =>
      prev.map((d) => {
        if (d.id !== posActiveDinerId) return d;
        const currentQty = d.cart?.[itemId] || 0;
        return {
          ...d,
          cart: { ...(d.cart || {}), [itemId]: currentQty + 1 }
        };
      })
    );
  };

  const handleChangePosDishQty = (dinerId, itemId, delta) => {
    setPosDiners((prev) =>
      prev.map((d) => {
        if (d.id !== dinerId) return d;
        const nextQty = (d.cart?.[itemId] || 0) + delta;
        const updatedCart = { ...(d.cart || {}) };
        if (nextQty <= 0) delete updatedCart[itemId];
        else updatedCart[itemId] = nextQty;
        return { ...d, cart: updatedCart };
      })
    );
  };

  const handleAddPosPerson = () => {
    const clean = posNewDinerName.trim() || `Persona ${posDiners.length}`;
    const newId = `diner_${Date.now()}`;
    setPosDiners((prev) => {
      const copy = [...prev];
      copy.splice(Math.max(0, copy.length - 1), 0, {
        id: newId,
        fullName: clean,
        isShared: false,
        cart: {}
      });
      return copy;
    });
    setPosActiveDinerId(newId);
    setPosNewDinerName('');
  };

  const handleSavePosOrderToCloud = async () => {
    if (!rolePermissions.canTakeOrders) return;

    let totalItems = 0;
    let totalAmount = 0;
    posDiners.forEach((d) => {
      Object.entries(d.cart || {}).forEach(([id, q]) => {
        const dish = findDishById(id);
        if (dish && q > 0) {
          totalItems += Number(q);
          totalAmount += dish.price * Number(q);
        }
      });
    });

    if (totalItems === 0) {
      triggerToast('⚠️ Agrega al menos un platillo.');
      return;
    }

    const isUpdating = !!editingOrderForAppend;
    const folio = isUpdating
      ? editingOrderForAppend.folio
      : `OBR-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderDocId = isUpdating
      ? editingOrderForAppend.orderDocId
      : `order_${folio}_${Date.now()}`;

    const mainDiner = posDiners.find((d) => !d.isShared) || posDiners[0];

    const cloudOrderPayload = {
      orderDocId,
      folio,
      status: isUpdating ? editingOrderForAppend.status : 'recibido',
      serviceType: posServiceType,
      deliveryStreet: posDelStreet.trim(),
      deliveryColony: posDelColony.trim(),
      deliveryReference: posDelRef.trim(),
      notes: posNotes.trim(),
      mainCustomerName: mainDiner ? mainDiner.fullName : 'Cliente',
      capturedByOperator: loggedOperator
        ? `${loggedOperator.fullName} (${loggedOperator.role})`
        : 'Mesero',
      dinersCount: posDiners.filter((d) => !d.isShared).length || 1,
      totalItems,
      totalAmount,
      dinersJson: JSON.stringify(posDiners),
      checkedItemsJson: JSON.stringify(
        isUpdating ? editingOrderForAppend.checkedItemsMap || {} : {}
      ),
      createdAtMs: isUpdating ? editingOrderForAppend.createdAtMs : Date.now(),
      updatedAtMs: Date.now()
    };

    try {
      if (fbUser && db) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_orders', orderDocId),
          cloudOrderPayload,
          { merge: true }
        );
      }
      setShowPosModal(false);
      setEditingOrderForAppend(null);
      playKitchenSound(soundEnabled, 'new');
      triggerToast(`🔥 Pedido #${folio} guardado en Firestore.`);
    } catch (err) {
      console.error('Error guardando pedido:', err);
    }
  };

  const handleOpenCashShiftCloud = async (e) => {
    e.preventDefault();
    if (!rolePermissions.canManageCashRegister) return;

    const newShift = {
      isOpen: true,
      shiftId: `shift_${Date.now()}`,
      openedAtMs: Date.now(),
      openedBy: loggedOperator ? loggedOperator.fullName : 'Administrador',
      initialFund: Number(openCashFundInput) || 0,
      notes: openCashNotesInput.trim() || 'Turno Abierto',
      lastWipedAtMs: cashShift.lastWipedAtMs || 0
    };

    try {
      if (fbUser && db) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_cash_shift', 'current_shift'),
          newShift,
          { merge: true }
        );
      }
      setShowCashModal(false);
      triggerToast('🟢 Caja Abierta en Firestore.');
    } catch (err) {
      console.error('Error abriendo caja:', err);
    }
  };

  const handleCloseAndWipeCashShiftCloud = async () => {
    if (!rolePermissions.canManageCashRegister) return;

    try {
      if (fbUser && db) {
        for (const ord of ordersList) {
          await deleteDoc(
            doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_orders', ord.orderDocId)
          );
        }
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_cash_shift', 'current_shift'),
          {
            isOpen: false,
            shiftId: '',
            openedAtMs: 0,
            openedBy: loggedOperator ? loggedOperator.fullName : 'Administrador',
            initialFund: 0,
            notes: '',
            lastWipedAtMs: Date.now()
          },
          { merge: true }
        );
      }
      setShowCashModal(false);
      triggerToast('🧹 Cierre de caja completado. Ventas del día reiniciadas a $0.');
    } catch (err) {
      console.error('Error cerrando caja:', err);
    }
  };

  const handleImportWhatsAppOrder = async () => {
    if (!rolePermissions.canTakeOrders || !whatsAppRawText.trim()) return;
    const raw = whatsAppRawText.trim();
    const folioMatch = raw.match(/#(OBR-\d+)/i);
    const folio = folioMatch
      ? folioMatch[1].toUpperCase()
      : `OBR-${Math.floor(1000 + Math.random() * 9000)}`;

    const importedCart = {};
    let totalItems = 0;
    let totalAmount = 0;

    MENU_CATALOG.forEach((sec) => {
      sec.items.forEach((dish) => {
        const escaped = dish.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(\\d+)x\\s+${escaped}`, 'i');
        const m = raw.match(regex);
        if (m) {
          const q = Number(m[1]) || 1;
          importedCart[dish.id] = q;
          totalItems += q;
          totalAmount += dish.price * q;
        }
      });
    });

    if (totalItems === 0) {
      importedCart['cor-1'] = 1;
      totalItems = 1;
      totalAmount = 300;
    }

    const orderDocId = `order_${folio}_${Date.now()}`;
    const payload = {
      orderDocId,
      folio,
      status: 'recibido',
      serviceType: 'Pedido WhatsApp',
      deliveryStreet: '',
      deliveryColony: '',
      deliveryReference: '',
      notes: 'Importado desde WhatsApp',
      mainCustomerName: 'Cliente WhatsApp',
      capturedByOperator: loggedOperator
        ? `${loggedOperator.fullName} (${loggedOperator.role})`
        : 'WhatsApp',
      dinersCount: 1,
      totalItems,
      totalAmount,
      dinersJson: JSON.stringify([
        { id: 'wa-1', fullName: 'Cliente WhatsApp', isShared: false, cart: importedCart }
      ]),
      checkedItemsJson: JSON.stringify({}),
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    };

    if (fbUser && db) {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'la_obrera_orders', orderDocId),
        payload,
        { merge: true }
      );
    }
    setWhatsAppRawText('');
    setShowWhatsAppModal(false);
    triggerToast(`📲 Pedido WhatsApp #${folio} importado a Firestore.`);
  };

  const handleExportCSV = () => {
    if (ordersList.length === 0) {
      triggerToast('No hay pedidos para exportar.');
      return;
    }
    const headers = [
      'Folio',
      'Estado',
      'Modalidad',
      'Cliente',
      'Personas',
      'Platillos',
      'TotalMXN',
      'Atendio',
      'FechaHora'
    ];
    const rows = ordersList.map((o) =>
      [
        o.folio,
        o.status,
        o.serviceType,
        o.mainCustomerName,
        o.dinersCount,
        o.totalItems,
        o.totalAmount,
        o.capturedByOperator,
        new Date(o.createdAtMs || Date.now()).toLocaleString('es-MX')
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `VENTAS_LA_OBRERA_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('📊 Reporte CSV descargado.');
  };

  const filteredOrders = useMemo(() => {
    return ordersList.filter((order) => {
      if (statusFilter === 'activos' && order.status === 'pagado') return false;
      if (statusFilter === 'nuevos' && order.status !== 'recibido') return false;
      if (
        statusFilter === 'en_parrilla' &&
        order.status !== 'en_parrilla' &&
        order.status !== 'en_brasas'
      )
        return false;
      if (
        statusFilter === 'pronto_en_mesa' &&
        order.status !== 'pronto_en_mesa' &&
        order.status !== 'listo'
      )
        return false;
      if (statusFilter === 'pagado' && order.status !== 'pagado') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mFolio = (order.folio || '').toLowerCase().includes(q);
        const mServ = (order.serviceType || '').toLowerCase().includes(q);
        const mCust = (order.mainCustomerName || '').toLowerCase().includes(q);
        const mDiner = (order.diners || []).some((d) =>
          (d.fullName || '').toLowerCase().includes(q)
        );
        return mFolio || mServ || mCust || mDiner;
      }
      return true;
    });
  }, [ordersList, statusFilter, searchQuery]);

  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'recibido':
        return {
          label: '🔴 NUEVO PEDIDO RECIBIDO',
          badgeClass: 'bg-red-500/25 text-red-200 border-red-400 animate-pulse',
          cardBorder: 'border-red-500/80 shadow-lg shadow-red-950/50'
        };
      case 'en_parrilla':
      case 'en_brasas':
        return {
          label: '🔥 YA ESTÁ EN PARRILLA',
          badgeClass: 'bg-orange-500/25 text-orange-200 border-orange-400',
          cardBorder: 'border-orange-500/80 shadow-lg shadow-orange-950/40'
        };
      case 'pronto_en_mesa':
      case 'listo':
        return {
          label: '🟢 YA PRONTO ESTARÁ EN SU MESA',
          badgeClass: 'bg-emerald-500/25 text-emerald-200 border-emerald-400',
          cardBorder: 'border-emerald-500/80 shadow-lg shadow-emerald-950/40'
        };
      case 'pagado':
        return {
          label: '💰 CUENTA COBRADA / PAGADA',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          cardBorder: 'border-stone-800 opacity-85'
        };
      default:
        return {
          label: 'ACTIVO',
          badgeClass: 'bg-stone-800 text-stone-300 border-stone-700',
          cardBorder: 'border-stone-800'
        };
    }
  };

  if (!loggedOperator) {
    const selectedUserPreview = usersList.find((u) => u.userId === selectedLoginUserId);

    return (
      <div className="min-h-screen bg-[#090807] text-[#f5efe6] flex items-center justify-center p-4">
        <div className="bg-[#14110f] border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#ff5500] shadow-xl bg-black mb-3 flex items-center justify-center">
              <OfficialLogoSVG className="w-full h-full" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono font-bold mb-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span>
                {cloudConnected
                  ? '☁️ FIRESTORE CONECTADO EN TIEMPO REAL'
                  : 'CONECTANDO SERVIDOR...'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-white">
              LA OBRERA • MONITOR POS
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Todas las contraseñas y pedidos web se sincronizan automáticamente en Firestore.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  1. Selecciona tu Usuario
                </label>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {usersList.length} / {MAX_USERS_LIMIT} en Firestore
                </span>
              </div>
              <select
                value={selectedLoginUserId}
                onChange={(e) => {
                  setSelectedLoginUserId(e.target.value);
                  setLoginError('');
                }}
                className="w-full px-3.5 py-3 bg-[#090807] border border-stone-700 focus:border-[#ff5500] rounded-xl text-sm text-white focus:outline-none"
              >
                {usersList.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.role === 'Administrador'
                      ? '👑'
                      : u.role === 'Mesero'
                      ? '🍽️'
                      : u.role === 'Cocina'
                      ? '🔥'
                      : '💼'}{' '}
                    {u.fullName} — [{u.role}]
                  </option>
                ))}
              </select>
              {selectedUserPreview && (
                <p className="text-[11px] text-amber-300/90 mt-1.5">
                  Puesto seleccionado: <strong>{selectedUserPreview.role}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                2. Contraseña Guardada en Firestore
              </label>
              <div className="relative">
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="Ingresa tu contraseña..."
                  className="w-full pl-4 pr-11 py-3 bg-[#090807] border border-stone-700 focus:border-[#ff5500] rounded-xl text-sm text-white font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-400"
                >
                  {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-950/80 border border-red-500 text-red-200 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff5500] via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-400 text-white font-bold uppercase tracking-wider text-sm shadow-xl transition flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Ingresar al Monitor en Tiempo Real</span>
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
            <a
              href="index.html"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Abrir Página Web de Pedidos</span>
            </a>
            <button
              type="button"
              onClick={() => setShowSyncGuideModal(true)}
              className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Guía Cloud</span>
            </button>
          </div>
        </div>

        {showSyncGuideModal && (
          <SyncGuideModal
            branchCode={branchCode}
            cloudConnected={cloudConnected}
            appId={appId}
            onClose={() => setShowSyncGuideModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090807] text-[#f5efe6] flex flex-col">
      <header className="sticky top-0 z-40 bg-[#090807]/95 backdrop-blur-md border-b border-orange-900/60 px-3 sm:px-6 py-3 shadow-2xl">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#ff5500] bg-black shrink-0">
              <OfficialLogoSVG className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold tracking-wider text-lg sm:text-xl text-white uppercase">
                  LA OBRERA <span className="text-amber-400">• MONITOR POS FIRESTORE</span>
                </h1>
                <button
                  onClick={() => setShowSyncGuideModal(true)}
                  className="text-[10px] font-mono uppercase tracking-widest bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold transition"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>☁️ FIRESTORE EN VIVO</span>
                </button>
                <span className="text-xs font-bold uppercase bg-stone-900 text-amber-300 border border-amber-500/40 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <span>{loggedOperator.fullName}</span>
                  <span className="bg-[#ff5500] text-white text-[10px] px-2 py-0.2 rounded">
                    {loggedOperator.role}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-1 font-mono flex-wrap">
                <span>
                  Sync Firestore: <strong className="text-stone-200">{lastSyncTime}</strong>
                </span>
                <span>•</span>
                <span className={cashShift.isOpen ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {cashShift.isOpen ? '🟢 CAJA ABIERTA COMPARTIDA' : '🔴 CAJA CERRADA ($0)'}
                </span>
                <span>•</span>
                <span className="text-amber-300">{wallClock}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="index.html"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden xl:inline">Página Web Clientes</span>
            </a>

            {rolePermissions.canManageCashRegister && (
              <button
                onClick={() => setShowCashModal(true)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 border ${
                  cashShift.isOpen
                    ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/60'
                    : 'bg-red-600 hover:bg-red-500 text-white border-red-400 animate-pulse'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>{cashShift.isOpen ? 'Corte / Cerrar Caja' : 'Abrir Caja del Día'}</span>
              </button>
            )}

            {rolePermissions.canManageUsers && (
              <button
                onClick={() => setShowUsersModal(true)}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/60 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                <span>Contraseñas BD ({usersList.length}/50)</span>
              </button>
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                soundEnabled
                  ? 'bg-[#14110f] border-emerald-500/50 text-emerald-300'
                  : 'bg-[#14110f] border-stone-700 text-stone-400'
              }`}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Sonido' : 'Silencio'}</span>
            </button>

            {rolePermissions.canTakeOrders && (
              <>
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/50 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span className="hidden lg:inline">Pegar WhatsApp</span>
                </button>

                <button
                  onClick={() => handleOpenPosCapture(null)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff5500] via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-400 text-white text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg transition flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Tomar Pedido</span>
                </button>
              </>
            )}

            <button
              onClick={() => setLoggedOperator(null)}
              className="px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* 6 KPIS COMPARTIDOS */}
      <section className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 pt-4 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div
            onClick={() => setStatusFilter('activos')}
            className="cursor-pointer bg-[#14110f] hover:bg-[#1c1714] border border-stone-800 rounded-2xl p-3.5 flex items-center justify-between transition"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">
                Pedidos Activos
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {kpiMetrics.activeCount}
              </span>
              <span className="text-[10px] text-amber-400 block">En monitor en vivo</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ff5500]/15 border border-[#ff5500]/40 text-[#ff5500] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('nuevos')}
            className="cursor-pointer bg-[#14110f] hover:bg-[#1c1714] border border-stone-800 rounded-2xl p-3.5 flex items-center justify-between transition"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-300 block">
                Nuevos Recibidos
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-red-400">
                {kpiMetrics.newCount}
              </span>
              <span className="text-[10px] text-stone-400 block">Web y Mesas</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('en_parrilla')}
            className="cursor-pointer bg-[#14110f] hover:bg-[#1c1714] border border-stone-800 rounded-2xl p-3.5 flex items-center justify-between transition"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-300 block">
                Ya en Parrilla
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-orange-400">
                {kpiMetrics.grillCount}
              </span>
              <span className="text-[10px] text-stone-400 block">Asándose al carbón</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('pronto_en_mesa')}
            className="cursor-pointer bg-[#14110f] hover:bg-[#1c1714] border border-stone-800 rounded-2xl p-3.5 flex items-center justify-between transition"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 block">
                Pronto en su Mesa
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {kpiMetrics.readyCount}
              </span>
              <span className="text-[10px] text-stone-400 block">Listos para entregar</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#14110f] border border-stone-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-300 block">
                Cuentas Persona
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-sky-400">
                {kpiMetrics.totalDiners}
              </span>
              <span className="text-[10px] text-stone-400 block">Comensales del día</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => {
              if (rolePermissions.canManageCashRegister) setShowCashModal(true);
            }}
            className="cursor-pointer bg-[#14110f] hover:bg-[#1c1714] border-2 border-amber-500/60 rounded-2xl p-3.5 flex items-center justify-between transition shadow-lg"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 block">
                Total Ventas del Día
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                ${kpiMetrics.totalSalesDay.toLocaleString('es-MX')}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold block">
                Cobrado: ${kpiMetrics.totalPaidMoney.toLocaleString('es-MX')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* BARRA DE PESTAÑAS Y FILTROS */}
      <section className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-2">
        <div className="bg-[#14110f] border border-stone-800 rounded-2xl p-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#090807] p-1.5 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveTab('kds')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
                activeTab === 'kds'
                  ? 'bg-gradient-to-r from-[#ff5500] to-amber-600 text-white shadow'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>1. Monitor de Pedidos en Automático</span>
            </button>

            <button
              onClick={() => setActiveTab('grill')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
                activeTab === 'grill'
                  ? 'bg-gradient-to-r from-[#ff5500] to-amber-600 text-white shadow'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Flame className="w-4 h-4 text-[#ff5500]" />
              <span>2. Totalizador de Parrilla</span>
              <span className="bg-stone-800 text-amber-400 px-2 py-0.5 rounded text-[10px]">
                {grillAggregatedItems.totalPiecesPending}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
                activeTab === 'database'
                  ? 'bg-gradient-to-r from-[#ff5500] to-amber-600 text-white shadow'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>3. Base de Datos Firestore ({ordersList.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {[
                { id: 'activos', label: '🔥 Activos' },
                { id: 'todos', label: 'Todos' },
                { id: 'nuevos', label: '🔴 Nuevos' },
                { id: 'en_parrilla', label: '🟠 Ya en Parrilla' },
                { id: 'pronto_en_mesa', label: '🟢 Pronto en su Mesa' },
                { id: 'pagado', label: '💰 Cobrados' }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setStatusFilter(st.id);
                    if (activeTab !== 'kds') setActiveTab('kds');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${
                    statusFilter === st.id
                      ? 'bg-[#ff5500] text-white border-amber-300'
                      : 'bg-[#090807] text-stone-300 border-stone-800 hover:border-stone-600'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar folio, mesa, cliente..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#090807] border border-stone-700 focus:border-[#ff5500] rounded-xl text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-grow max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-4">
        {activeTab === 'kds' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full bg-[#14110f] border border-stone-800 rounded-3xl p-12 text-center">
                <Flame className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-xl font-bold uppercase text-white">
                  Esperando Pedidos en Automático desde la Página Web o POS
                </h3>
                <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto mt-1">
                  Cuando un cliente confirma su pedido en la página web, aparece aquí automáticamente sin recargar.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const stBadge = getOrderStatusBadge(order.status);
                const isDelivery = order.serviceType === 'Servicio a Domicilio';
                const elapsedMin = Math.max(
                  0,
                  Math.floor((Date.now() - (order.createdAtMs || Date.now())) / 60000)
                );

                return (
                  <article
                    key={order.orderDocId}
                    className={`bg-[#14110f] border-2 ${stBadge.cardBorder} rounded-3xl p-4 flex flex-col justify-between transition-all`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 border-b border-stone-800 pb-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-extrabold bg-black text-amber-400 px-2.5 py-0.5 rounded-lg border border-amber-500/40">
                              #{order.folio}
                            </span>
                            <span className="text-lg font-extrabold uppercase text-white">
                              {order.serviceType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400 flex-wrap">
                            <span className="font-mono text-amber-300">
                              ⏱️ {elapsedMin === 0 ? 'Justo ahora' : `hace ${elapsedMin} min`}
                            </span>
                            <span>•</span>
                            <span>{order.capturedByOperator || 'Web'}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border text-right ${stBadge.badgeClass}`}
                        >
                          {stBadge.label}
                        </span>
                      </div>

                      {isDelivery && order.deliveryStreet && (
                        <div className="mb-3 bg-orange-950/40 border border-[#ff5500]/50 rounded-2xl p-3 text-xs space-y-1">
                          <div className="text-amber-400 font-bold uppercase flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#ff5500]" />
                            <span>Envío a Domicilio:</span>
                          </div>
                          <p className="text-white font-semibold">
                            {order.deliveryStreet}, Col. {order.deliveryColony}
                          </p>
                          <p className="text-stone-300 text-[11px]">
                            <strong>Ref:</strong> {order.deliveryReference}
                          </p>
                        </div>
                      )}

                      {order.notes && (
                        <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-200">
                          📝 <strong>Nota:</strong> {order.notes}
                        </div>
                      )}

                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 mb-4">
                        {(order.diners || []).map((diner) => {
                          const entries = Object.entries(diner.cart || {})
                            .map(([itemId, qty]) => ({
                              dish: findDishById(itemId),
                              itemId,
                              qty
                            }))
                            .filter((e) => e.dish && e.qty > 0);

                          if (entries.length === 0) return null;
                          const personSubtotal = entries.reduce(
                            (acc, e) => acc + e.dish.price * e.qty,
                            0
                          );

                          return (
                            <div
                              key={diner.id}
                              className="bg-[#090807] border border-stone-800 rounded-2xl p-3"
                            >
                              <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 mb-2">
                                <span className="text-xs font-bold uppercase text-amber-300 truncate">
                                  👤 {diner.fullName}
                                </span>
                                <span className="font-mono text-xs font-bold text-white bg-stone-900 px-2 py-0.5 rounded border border-stone-700">
                                  ${personSubtotal}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {entries.map(({ dish, itemId, qty }) => {
                                  const checkKey = `${diner.id}_${itemId}`;
                                  const isDone = !!(
                                    order.checkedItemsMap && order.checkedItemsMap[checkKey]
                                  );
                                  return (
                                    <div
                                      key={checkKey}
                                      onClick={() => handleToggleDishCheck(order, checkKey)}
                                      className={`flex items-center justify-between gap-2 text-xs p-1.5 rounded-lg cursor-pointer transition ${
                                        isDone
                                          ? 'bg-emerald-950/30 text-stone-500 line-through'
                                          : 'bg-stone-900/80 hover:bg-stone-800 text-stone-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                                            isDone
                                              ? 'bg-emerald-500 border-emerald-400 text-black font-bold'
                                              : 'border-stone-600 bg-[#090807]'
                                          }`}
                                        >
                                          {isDone ? '✓' : ''}
                                        </span>
                                        <span className="font-extrabold text-amber-400 shrink-0">
                                          {qty}x
                                        </span>
                                        <span className="truncate">{dish.name}</span>
                                      </div>
                                      <span className="text-[11px] text-stone-400 shrink-0">
                                        ${dish.price * qty}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-stone-400 block">
                            Total Mesa ({order.totalItems} pzs)
                          </span>
                          <span className="text-2xl font-extrabold text-amber-400">
                            ${order.totalAmount} MXN
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {rolePermissions.canTakeOrders && order.status !== 'pagado' && (
                            <button
                              onClick={() => handleOpenPosCapture(order)}
                              className="px-2.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-emerald-300 border border-stone-700 text-xs font-bold flex items-center gap-1"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Agregar</span>
                            </button>
                          )}
                          <button
                            onClick={() => setTicketModalOrder(order)}
                            className="px-2.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 text-xs font-bold flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Ticket</span>
                          </button>
                        </div>
                      </div>

                      {rolePermissions.canTrackKitchen && (
                        <div className="bg-[#090807] border border-orange-500/30 rounded-2xl p-2.5 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 block">
                            🔥 Seguimiento de Cocina:
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleUpdateOrderStatus(order, 'en_parrilla')}
                              className={`py-2.5 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 border ${
                                order.status === 'en_parrilla' || order.status === 'en_brasas'
                                  ? 'bg-orange-600 text-white border-amber-300 shadow-lg'
                                  : 'bg-orange-600/20 hover:bg-orange-600 text-orange-200 hover:text-white border-orange-500/40'
                              }`}
                            >
                              <Flame className="w-4 h-4 shrink-0" />
                              <span>Ya en Parrilla</span>
                            </button>

                            <button
                              onClick={() => handleUpdateOrderStatus(order, 'pronto_en_mesa')}
                              className={`py-2.5 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 border ${
                                order.status === 'pronto_en_mesa' || order.status === 'listo'
                                  ? 'bg-emerald-600 text-white border-emerald-300 shadow-lg'
                                  : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border-emerald-500/40'
                              }`}
                            >
                              <Utensils className="w-4 h-4 shrink-0" />
                              <span>Pronto en Mesa</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {rolePermissions.canChargeOrders && (
                        <div className="space-y-1.5">
                          {order.status === 'pagado' ? (
                            <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase text-center">
                              ✅ Cuenta Cobrada ({order.paymentInfo?.method || 'Efectivo'})
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setChargeModalOrder(order);
                                setPaymentMethod('Efectivo');
                                setCashReceivedInput(String(order.totalAmount || ''));
                              }}
                              className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2"
                            >
                              <Banknote className="w-4 h-4" />
                              <span>💰 Cobrar Pedido (${order.totalAmount} MXN)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'grill' && (
          <div className="bg-[#14110f] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold uppercase text-white">
                  🔥 Totalizador de Cortes y Platillos por Asar en Parrilla
                </h2>
                <p className="text-xs text-stone-400">
                  Suma automática de todos los pedidos activos en Firestore.
                </p>
              </div>
              <span className="text-xs font-mono bg-[#090807] border border-stone-700 text-amber-400 px-3.5 py-1.5 rounded-xl">
                Piezas pendientes: <strong>{grillAggregatedItems.totalPiecesPending}</strong>
              </span>
            </div>

            {grillAggregatedItems.items.length === 0 ? (
              <div className="py-12 text-center text-stone-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-lg font-bold uppercase text-white">Todo despachado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {grillAggregatedItems.items.map(({ dish, count, tables }) => (
                  <div
                    key={dish.id}
                    className="bg-[#090807] border border-stone-800 rounded-2xl p-4 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-stone-400 block">
                          {dish.categoryTitle}
                        </span>
                        <h4 className="text-base sm:text-lg font-extrabold text-white uppercase">
                          {dish.name}
                        </h4>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#ff5500] to-amber-600 text-white font-extrabold text-2xl">
                        {count}x
                      </span>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-stone-800 flex flex-wrap gap-1">
                      {tables.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] bg-stone-900 border border-stone-700 text-amber-300 px-2 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'database' && (
          <div className="bg-[#14110f] border border-stone-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-6 bg-[#090807] border-b border-stone-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold uppercase text-white">
                  Base de Datos Firestore de Ventas del Día
                </h2>
                <p className="text-xs text-stone-400">
                  Sincronizada automáticamente entre la Página Web y el Monitor POS.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar Excel / CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-950 text-stone-400 uppercase border-b border-stone-800">
                    <th className="py-3.5 px-4">Folio</th>
                    <th className="py-3.5 px-4">Mesa / Destino</th>
                    <th className="py-3.5 px-4">Cliente / Personas</th>
                    <th className="py-3.5 px-4">Origen</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Seguimiento</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {ordersList.map((ord) => {
                    const stBadge = getOrderStatusBadge(ord.status);
                    return (
                      <tr key={ord.orderDocId} className="hover:bg-stone-900/60">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          #{ord.folio}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{ord.serviceType}</td>
                        <td className="py-3 px-4 text-stone-300">
                          {ord.mainCustomerName} ({ord.dinersCount} pers.)
                        </td>
                        <td className="py-3 px-4 text-stone-400">{ord.capturedByOperator}</td>
                        <td className="py-3 px-4 font-extrabold text-amber-400 text-sm">
                          ${ord.totalAmount}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${stBadge.badgeClass}`}
                          >
                            {stBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setTicketModalOrder(ord)}
                            className="px-2 py-1 rounded bg-stone-800 text-stone-200 text-[10px]"
                          >
                            Ticket
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE COBRO */}
      {chargeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14110f] border-2 border-amber-500 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 block">
                  COBRO DE PEDIDO #{chargeModalOrder.folio}
                </span>
                <h3 className="text-xl font-extrabold uppercase text-white">
                  {chargeModalOrder.serviceType} — ${chargeModalOrder.totalAmount} MXN
                </h3>
              </div>
              <button
                onClick={() => setChargeModalOrder(null)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-amber-400 mb-1.5">
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Efectivo', 'Tarjeta', 'Transferencia'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2.5 rounded-xl text-xs font-bold uppercase border transition ${
                      paymentMethod === m
                        ? 'bg-[#ff5500] text-white border-amber-300'
                        : 'bg-[#090807] text-stone-300 border-stone-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'Efectivo' && (
              <div className="bg-[#090807] border border-stone-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-stone-300">Efectivo Recibido ($):</label>
                  <input
                    type="number"
                    value={cashReceivedInput}
                    onChange={(e) => setCashReceivedInput(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-[#14110f] border border-stone-700 rounded-xl text-right font-mono font-bold text-amber-300"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                  <span className="text-xs font-bold uppercase text-emerald-400">
                    Cambio a Entregar:
                  </span>
                  <span className="text-lg font-mono font-extrabold text-emerald-400">
                    $
                    {Math.max(
                      0,
                      (Number(cashReceivedInput) || 0) - Number(chargeModalOrder.totalAmount || 0)
                    )}{' '}
                    MXN
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                handleUpdateOrderStatus(chargeModalOrder, 'pagado', {
                  method: paymentMethod,
                  chargedBy: loggedOperator.fullName,
                  chargedAtMs: Date.now()
                });
                setChargeModalOrder(null);
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-extrabold uppercase tracking-wider text-sm shadow-xl flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirmar Cobro (${chargeModalOrder.totalAmount} MXN)</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL POS CAPTURA */}
      {showPosModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#14110f] border-2 border-amber-500/60 rounded-3xl max-w-6xl w-full h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#090807] border-b border-stone-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg sm:text-xl font-extrabold uppercase text-white">
                {editingOrderForAppend
                  ? `Agregar Platillos al Pedido #${editingOrderForAppend.folio}`
                  : 'Tomar Nuevo Pedido en Tiempo Real'}
              </h3>
              <button
                onClick={() => setShowPosModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-stone-800 overflow-hidden bg-[#090807]/60">
                <div className="p-3 bg-[#14110f] border-b border-stone-800 space-y-2 shrink-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      onClick={() => setPosCategory('todos')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase shrink-0 ${
                        posCategory === 'todos'
                          ? 'bg-[#ff5500] text-white'
                          : 'bg-[#090807] text-stone-300 border border-stone-800'
                      }`}
                    >
                      Todos
                    </button>
                    {MENU_CATALOG.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setPosCategory(cat.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase shrink-0 ${
                          posCategory === cat.id
                            ? 'bg-[#ff5500] text-white'
                            : 'bg-[#090807] text-stone-300 border border-stone-800'
                        }`}
                      >
                        {cat.title}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    placeholder="Buscar platillo..."
                    className="w-full px-3 py-1.5 bg-[#090807] border border-stone-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="flex-grow overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
                  {MENU_CATALOG.filter(
                    (c) => posCategory === 'todos' || c.id === posCategory
                  ).flatMap((c) =>
                    c.items
                      .filter(
                        (i) =>
                          !posSearch.trim() ||
                          i.name.toLowerCase().includes(posSearch.toLowerCase())
                      )
                      .map((dish) => (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => handleAddDishToPosDiner(dish.id)}
                          className="text-left bg-[#14110f] hover:bg-stone-800 border border-stone-800 hover:border-amber-500/60 rounded-xl p-3 flex items-center justify-between gap-2 transition"
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase text-stone-400 block">
                              {c.title}
                            </span>
                            <span className="text-sm font-bold text-white block">{dish.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-amber-400 block">
                              ${dish.price}
                            </span>
                            <span className="text-[10px] text-[#ff5500] font-bold">+ Agregar</span>
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col overflow-hidden bg-[#14110f]">
                <div className="p-3.5 overflow-y-auto flex-grow space-y-3">
                  <div className="bg-[#090807] border border-stone-800 rounded-2xl p-3 space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-amber-400">
                      Mesa o Modalidad
                    </label>
                    <select
                      value={posServiceType}
                      onChange={(e) => setPosServiceType(e.target.value)}
                      className="w-full bg-[#14110f] border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {[
                        'Mesa 1',
                        'Mesa 2',
                        'Mesa 3',
                        'Mesa 4',
                        'Mesa 5',
                        'Mesa 6',
                        'Mesa 7',
                        'Mesa 8',
                        'Mesa 9',
                        'Mesa 10',
                        'Para Llevar / Recoger',
                        'Servicio a Domicilio'
                      ].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-[#090807] border border-stone-800 rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-amber-400">
                        Cuentas por Persona
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={posNewDinerName}
                          onChange={(e) => setPosNewDinerName(e.target.value)}
                          placeholder="Nombre..."
                          className="px-2 py-1 bg-[#14110f] border border-stone-700 rounded-lg text-xs text-white w-32"
                        />
                        <button
                          type="button"
                          onClick={handleAddPosPerson}
                          className="px-2.5 py-1 rounded-lg bg-[#ff5500] text-white text-xs font-bold"
                        >
                          + Persona
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {posDiners.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setPosActiveDinerId(d.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${
                            posActiveDinerId === d.id
                              ? 'bg-[#ff5500] text-white border-amber-300'
                              : 'bg-[#14110f] text-stone-300 border-stone-700'
                          }`}
                        >
                          {d.fullName}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {posDiners.map((diner) => {
                        const entries = Object.entries(diner.cart || {})
                          .map(([id, q]) => ({ dish: findDishById(id), id, q }))
                          .filter((e) => e.dish && e.q > 0);
                        const sub = entries.reduce((acc, e) => acc + e.dish.price * e.q, 0);

                        return (
                          <div
                            key={diner.id}
                            className="bg-[#14110f] border border-stone-800 rounded-xl p-2.5"
                          >
                            <div className="flex justify-between text-xs font-bold text-amber-300 border-b border-stone-800 pb-1 mb-1">
                              <span>{diner.fullName}</span>
                              <span>${sub}</span>
                            </div>
                            {entries.length === 0 ? (
                              <p className="text-[11px] text-stone-500">Sin platillos</p>
                            ) : (
                              entries.map(({ dish, id, q }) => (
                                <div
                                  key={id}
                                  className="flex items-center justify-between text-xs py-1"
                                >
                                  <span className="truncate">{dish.name}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleChangePosDishQty(diner.id, id, -1)}
                                      className="w-5 h-5 rounded bg-stone-800 text-white"
                                    >
                                      -
                                    </button>
                                    <span className="font-bold text-amber-400">{q}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleChangePosDishQty(diner.id, id, 1)}
                                      className="w-5 h-5 rounded bg-[#ff5500] text-white"
                                    >
                                      +
                                    </button>
                                    <span className="w-12 text-right font-mono">
                                      ${dish.price * q}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-[#090807] border-t border-stone-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-stone-400 block">Total</span>
                    <span className="text-2xl font-extrabold text-amber-400">
                      $
                      {posDiners.reduce(
                        (acc, d) =>
                          acc +
                          Object.entries(d.cart || {}).reduce((s, [id, q]) => {
                            const dish = findDishById(id);
                            return s + (dish ? dish.price * q : 0);
                          }, 0),
                        0
                      )}{' '}
                      MXN
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSavePosOrderToCloud}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff5500] to-amber-500 text-white font-bold uppercase text-xs sm:text-sm shadow-xl"
                  >
                    Enviar a Cocina y Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GESTIÓN DE USUARIOS Y CONTRASEÑAS EN FIRESTORE */}
      {showUsersModal && rolePermissions.canManageUsers && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#14110f] border-2 border-amber-500/70 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 bg-[#090807] border-b border-stone-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold uppercase text-white">
                  Base de Datos de Contraseñas en Firestore ({usersList.length}/{MAX_USERS_LIMIT})
                </h3>
                <p className="text-xs text-emerald-400">
                  Todas las contraseñas se guardan automáticamente en la colección Firestore `la_obrera_users` y `master_directory`.
                </p>
              </div>
              <button
                onClick={() => setShowUsersModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              <form
                onSubmit={handleCreateCloudUser}
                className="bg-[#090807] border border-stone-800 rounded-2xl p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] uppercase text-stone-400 mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Nombre del empleado"
                      className="w-full px-3 py-2 bg-[#14110f] border border-stone-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] uppercase text-stone-400 mb-1">Rol *</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full px-3 py-2 bg-[#14110f] border border-stone-700 rounded-xl text-xs text-white"
                    >
                      <option value="Mesero">🍽️ Mesero</option>
                      <option value="Cocina">🔥 Cocina</option>
                      <option value="Cajero">💼 Cajero</option>
                      <option value="Administrador">👑 Administrador</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase text-amber-400 mb-1">Contraseña *</label>
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Clave"
                      className="w-full px-3 py-2 bg-[#14110f] border border-stone-700 rounded-xl text-xs font-mono text-amber-300"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#ff5500] to-amber-500 text-white font-bold text-xs uppercase"
                    >
                      Guardar en BD
                    </button>
                  </div>
                </div>
              </form>

              <div className="bg-[#090807] border border-stone-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-900 text-stone-400 uppercase border-b border-stone-800">
                        <th className="py-3 px-3">#</th>
                        <th className="py-3 px-3">Nombre</th>
                        <th className="py-3 px-3">Rol</th>
                        <th className="py-3 px-3">Contraseña en Firestore</th>
                        <th className="py-3 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {usersList.map((u, i) => {
                        const editState = editingUserMap[u.userId] || {};
                        const currentNameVal =
                          editState.fullName !== undefined ? editState.fullName : u.fullName;
                        const currentRoleVal =
                          editState.role !== undefined ? editState.role : u.role;
                        const currentPassVal =
                          editState.password !== undefined ? editState.password : u.password;

                        return (
                          <tr key={u.userId} className="hover:bg-stone-900/60">
                            <td className="py-3 px-3 font-mono text-stone-400">{i + 1}</td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={currentNameVal}
                                onChange={(e) =>
                                  setEditingUserMap((prev) => ({
                                    ...prev,
                                    [u.userId]: { ...prev[u.userId], fullName: e.target.value }
                                  }))
                                }
                                className="w-full min-w-[160px] px-2.5 py-1.5 bg-[#14110f] border border-stone-700 rounded-lg text-xs font-bold text-white"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={currentRoleVal}
                                onChange={(e) =>
                                  setEditingUserMap((prev) => ({
                                    ...prev,
                                    [u.userId]: { ...prev[u.userId], role: e.target.value }
                                  }))
                                }
                                className="px-2.5 py-1.5 bg-[#14110f] border border-stone-700 rounded-lg text-xs text-amber-300 font-bold"
                              >
                                <option value="Mesero">🍽️ Mesero</option>
                                <option value="Cocina">🔥 Cocina</option>
                                <option value="Cajero">💼 Cajero</option>
                                <option value="Administrador">👑 Administrador</option>
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={currentPassVal}
                                onChange={(e) =>
                                  setEditingUserMap((prev) => ({
                                    ...prev,
                                    [u.userId]: { ...prev[u.userId], password: e.target.value }
                                  }))
                                }
                                className="w-36 px-2.5 py-1.5 bg-[#14110f] border border-stone-700 rounded-lg text-xs font-mono font-bold text-emerald-300"
                              />
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateCloudUser(u)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                              >
                                Guardar en BD
                              </button>
                              {!u.isMasterAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCloudUser(u)}
                                  className="px-3 py-1.5 rounded-lg bg-red-950 text-red-200 border border-red-500/40 font-bold text-[11px]"
                                >
                                  Borrar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAJA */}
      {showCashModal && rolePermissions.canManageCashRegister && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14110f] border-2 border-emerald-500/60 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-xl font-extrabold uppercase text-white">Control de Caja del Día</h3>
              <button
                onClick={() => setShowCashModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cashShift.isOpen ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleCloseAndWipeCashShiftCloud}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-700 text-white font-extrabold uppercase text-xs sm:text-sm shadow-xl"
                >
                  Confirmar Cierre de Caja y Reiniciar Ventas a $0
                </button>
              </div>
            ) : (
              <form onSubmit={handleOpenCashShiftCloud} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-amber-400 mb-1">
                    Fondo Inicial ($)
                  </label>
                  <input
                    type="number"
                    value={openCashFundInput}
                    onChange={(e) => setOpenCashFundInput(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-[#090807] border border-stone-700 rounded-xl text-sm font-mono font-bold text-emerald-400"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-extrabold uppercase text-sm"
                >
                  Abrir Caja
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL WHATSAPP */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14110f] border-2 border-emerald-500/60 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-lg font-extrabold uppercase text-white">Importar WhatsApp</h3>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={7}
              value={whatsAppRawText}
              onChange={(e) => setWhatsAppRawText(e.target.value)}
              placeholder="Pega el mensaje de WhatsApp..."
              className="w-full p-3 bg-[#090807] border border-stone-700 rounded-2xl text-xs text-white font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportWhatsAppOrder}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold uppercase"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET */}
      {ticketModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14110f] border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-lg font-extrabold uppercase text-white">
                Ticket #{ticketModalOrder.folio}
              </h3>
              <button
                onClick={() => setTicketModalOrder(null)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#090807] border border-stone-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="text-center border-b border-stone-800 pb-2">
                <h4 className="font-extrabold text-base text-amber-400">
                  LA OBRERA GRILL ASADERO
                </h4>
                <p className="text-stone-300">
                  Folio #{ticketModalOrder.folio} • {ticketModalOrder.serviceType}
                </p>
              </div>

              <div className="space-y-2">
                {(ticketModalOrder.diners || []).map((d) => {
                  const entries = Object.entries(d.cart || {})
                    .map(([id, q]) => ({ dish: findDishById(id), q }))
                    .filter((e) => e.dish && e.q > 0);
                  if (entries.length === 0) return null;
                  const sub = entries.reduce((acc, e) => acc + e.dish.price * e.q, 0);
                  return (
                    <div key={d.id} className="border-b border-stone-800 pb-2">
                      <div className="flex justify-between font-bold text-amber-300 mb-1">
                        <span>👤 {d.fullName}</span>
                        <span>${sub}</span>
                      </div>
                      {entries.map(({ dish, q }, idx) => (
                        <div key={idx} className="flex justify-between text-stone-300">
                          <span>
                            {q}x {dish.name}
                          </span>
                          <span>${dish.price * q}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-lg font-extrabold text-amber-400 pt-1">
                <span>GRAN TOTAL:</span>
                <span>${ticketModalOrder.totalAmount} MXN</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.print()}
                className="py-2.5 rounded-xl bg-[#ff5500] text-white font-bold text-xs uppercase flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setTicketModalOrder(null)}
                className="py-2.5 rounded-xl bg-stone-800 text-stone-200 font-bold text-xs uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showSyncGuideModal && (
        <SyncGuideModal
          branchCode={branchCode}
          cloudConnected={cloudConnected}
          appId={appId}
          onClose={() => setShowSyncGuideModal(false)}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[110] bg-stone-900 border-2 border-amber-500 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-medium max-w-md">
          <Wifi className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
