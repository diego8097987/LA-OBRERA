import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  extractFriendlyErrorMessage,
  googleProvider,
  logFirestoreError,
  OperationType,
  provisionStaffAuthAccount,
} from '../firebase';
import {
  mapFirebaseAuthError,
  normalizeEmail,
  validateEmail,
  validatePasswordForSignIn,
  validateStaffRegistration,
} from '../utils/authValidation';
import { INITIAL_MENU_ITEMS } from '../data/menuCatalog';
import type {
  ActiveWorkspaceRole,
  AuditAction,
  AuditLog,
  CashRegisterState,
  DailyReport,
  KitchenStation,
  MenuCategoryId,
  MenuItem,
  Order,
  OrderDiner,
  OrderLineItem,
  OrderPrivateCustomer,
  OrderStatus,
  PaymentMethod,
  ServiceType,
  StaffProfile,
  StaffRole,
} from '../types/pos';
import {
  buildCancellationAuditSummary,
  calculateCashCutReconciliation,
  calculateCheckoutPayment,
  calculateItemsSubtotal,
  canCancelOrder,
  canTransitionOrderStatus,
  computeDailySalesSummary,
  generateOrderFolio,
  getLocalDateKey,
  MAX_COLONY_LENGTH,
  MAX_CUSTOMER_NAME_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_LINE_NOTES_LENGTH,
  MAX_MENU_DESC_LENGTH,
  MAX_MENU_NAME_LENGTH,
  MAX_ORDER_NOTES_LENGTH,
  MAX_PHONE_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_STREET_LENGTH,
  roundMoney,
  sanitizeText,
  validateCancellationReason,
  validateNewMenuItemInput,
} from '../utils/posCalculations';

export interface CreateOrderPayload {
  serviceType: ServiceType;
  diners: OrderDiner[];
  items: OrderLineItem[];
  splitSharedEqually: boolean;
  orderNotes: string;
  customerName: string;
  phone: string;
  street: string;
  colony: string;
  reference: string;
}

export interface AppendOrderPayload {
  orderId: string;
  diners: OrderDiner[];
  items: OrderLineItem[];
  splitSharedEqually: boolean;
  orderNotes: string;
}

export interface ProcessPaymentPayload {
  orderId: string;
  paymentMethod: PaymentMethod;
  tip: number;
  amountReceived: number;
}

export interface ToastNotice {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
}

export interface CreateStaffAccountPayload {
  displayName: string;
  email: string;
  password: string;
  role: ActiveWorkspaceRole;
}

export interface CreateMenuItemPayload {
  name: string;
  categoryId: MenuCategoryId;
  station: KitchenStation;
  price: number;
  desc: string;
}

export interface CloseCashRegisterPayload {
  dateKey: string;
  countedCash: number;
}

interface PosContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  needsEmailVerification: boolean;
  currentStaff: StaffProfile | null;
  activeWorkspace: ActiveWorkspaceRole;
  canAccessWorkspace: (role: ActiveWorkspaceRole) => boolean;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (
    displayName: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  resendVerificationEmail: () => Promise<{ ok: boolean; message: string }>;
  reloadEmailVerification: () => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  exitSession: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  loadingData: boolean;
  orders: Order[];
  menuItems: MenuItem[];
  staffList: StaffProfile[];
  cashRegister: CashRegisterState | null;
  dailyReports: DailyReport[];
  auditLogs: AuditLog[];
  createOrder: (payload: CreateOrderPayload) => Promise<Order>;
  appendItemsToOrder: (payload: AppendOrderPayload) => Promise<void>;
  updateOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  cancelOrder: (orderId: string, reason: string) => Promise<{ ok: boolean; message: string }>;
  processOrderPayment: (payload: ProcessPaymentPayload) => Promise<Order>;
  loadOrderPrivateCustomer: (orderId: string) => Promise<OrderPrivateCustomer | null>;
  addMenuItem: (payload: CreateMenuItemPayload) => Promise<{ ok: boolean; message: string }>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  toggleMenuAvailability: (itemId: string, available: boolean) => Promise<void>;
  updateMenuPrice: (itemId: string, price: number) => Promise<boolean>;
  createStaffAccount: (payload: CreateStaffAccountPayload) => Promise<{ ok: boolean; message: string }>;
  updateStaffRole: (uid: string, role: StaffRole, active: boolean) => Promise<void>;
  deletePendingStaff: (uid: string) => Promise<void>;
  openCashRegister: (openingCash: number) => Promise<CashRegisterState>;
  closeCashRegisterAndSaveCut: (payload: CloseCashRegisterPayload) => Promise<DailyReport>;
  toast: ToastNotice | null;
  notify: (message: string, tone?: 'success' | 'info' | 'error') => void;
}

const PosContext = createContext<PosContextValue | null>(null);

function tsToMs(value: unknown, fallback: number = Date.now()): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function safePersonName(raw: string | undefined | null, fallback: string): string {
  const cleaned = sanitizeText(raw || '', MAX_DISPLAY_NAME_LENGTH);
  return cleaned.length >= 2 ? cleaned : fallback;
}

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState<boolean>(false);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspaceRole>('mesero');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuDocs, setMenuDocs] = useState<Record<string, Partial<MenuItem>>>({});
  const [cashRegister, setCashRegister] = useState<CashRegisterState | null>(null);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [toast, setToast] = useState<ToastNotice | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const activeListenersRef = useRef<Set<() => void>>(new Set());
  const hadStaffDocRef = useRef<boolean>(false);

  const registerListener = useCallback((unsub: () => void) => {
    activeListenersRef.current.add(unsub);
    return () => {
      activeListenersRef.current.delete(unsub);
      unsub();
    };
  }, []);

  const unsubscribeAllListeners = useCallback(() => {
    activeListenersRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // Ignore teardown errors
      }
    });
    activeListenersRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      unsubscribeAllListeners();
    };
  }, [unsubscribeAllListeners]);

  const notify = useCallback((message: string, tone: 'success' | 'info' | 'error' = 'info') => {
    setToast({ id: Date.now(), message, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3400);
  }, []);

  const menuItems = useMemo<MenuItem[]>(() => {
    const baseIds = new Set(INITIAL_MENU_ITEMS.map((i) => i.id));
    const mergedBase = INITIAL_MENU_ITEMS.map((item) => {
      const override = menuDocs[item.id];
      if (!override) return item;
      return {
        ...item,
        name: override.name ?? item.name,
        desc: typeof override.desc === 'string' ? override.desc : item.desc,
        categoryId: override.categoryId ?? item.categoryId,
        price: typeof override.price === 'number' ? override.price : item.price,
        available: typeof override.available === 'boolean' ? override.available : item.available,
        station: override.station ?? item.station,
      };
    });

    const customDishes: MenuItem[] = Object.entries(menuDocs)
      .filter(
        ([id, docData]) =>
          !baseIds.has(id) && typeof docData.name === 'string' && typeof docData.price === 'number'
      )
      .map(([id, d]) => ({
        id,
        categoryId: (d.categoryId || 'individual') as MenuCategoryId,
        name: String(d.name),
        price: Number(d.price),
        desc: String(d.desc || ''),
        station: (d.station || 'parrilla') as KitchenStation,
        available: typeof d.available === 'boolean' ? d.available : true,
        isCustom: true,
      }));

    return [...customDishes, ...mergedBase];
  }, [menuDocs]);

  // Strict independent accounts: every role accesses ONLY its own workspace
  const canAccessWorkspace = useCallback(
    (role: ActiveWorkspaceRole): boolean => {
      if (!currentStaff || !currentStaff.active || currentStaff.role === 'pending') return false;
      return currentStaff.role === role;
    },
    [currentStaff]
  );

  const writeAuditLog = useCallback(
    async (action: AuditAction, targetId: string, summary: string) => {
      if (!currentStaff || !currentStaff.active || currentStaff.role === 'pending') return;
      const safeRole: ActiveWorkspaceRole = currentStaff.role;
      const rawSummary = sanitizeText(summary, 200);
      const safeSummary = rawSummary.length >= 3 ? rawSummary : 'Evento POS';
      const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'system';
      const logId = makeDocId('aud');

      try {
        await setDoc(doc(db, 'audit_logs', logId), {
          action,
          actorUid: currentStaff.uid,
          actorRole: safeRole,
          targetId: safeTarget,
          summary: safeSummary,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreError(err, OperationType.CREATE, `audit_logs/${logId}`);
      }
    },
    [currentStaff]
  );

  const loadVerifiedStaffProfile = useCallback(async (user: User) => {
    setLoadingData(true);
    const staffPath = `staff/${user.uid}`;
    const contactPath = `staff/${user.uid}/private/contact`;
    try {
      const staffRef = doc(db, 'staff', user.uid);
      const snap = await getDoc(staffRef);
      const isBootstrap = (user.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      if (!snap.exists()) {
        const initialRole: StaffRole = isBootstrap ? 'admin' : 'pending';
        const initialActive = isBootstrap;
        const safeDisplayName = safePersonName(
          user.displayName || (user.email ? user.email.split('@')[0] : 'Personal'),
          'Personal'
        );

        const batch = writeBatch(db);
        batch.set(staffRef, {
          uid: user.uid,
          displayName: safeDisplayName,
          role: initialRole,
          active: initialActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'staff', user.uid, 'private', 'contact'), {
          uid: user.uid,
          email: sanitizeText(user.email || 'sin-correo@local', 160),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

        const createdProfile: StaffProfile = {
          uid: user.uid,
          displayName: safeDisplayName,
          role: initialRole,
          active: initialActive,
          email: user.email || '',
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        };
        setCurrentStaff(createdProfile);
        if (initialRole !== 'pending') {
          setActiveWorkspaceState(initialRole);
        }
      } else {
        const data = snap.data();
        const role = (isBootstrap ? 'admin' : data.role) as StaffRole;
        const active = isBootstrap ? true : Boolean(data.active);
        setCurrentStaff({
          uid: user.uid,
          displayName: String(data.displayName || 'Personal'),
          role,
          active,
          email: user.email || '',
          createdAtMs: tsToMs(data.createdAt),
          updatedAtMs: tsToMs(data.updatedAt),
        });
        if (active && role !== 'pending') {
          setActiveWorkspaceState(role);
        }
      }
    } catch (err) {
      logFirestoreError(err, OperationType.WRITE, `${staffPath} | ${contactPath}`);
      setAuthError(
        extractFriendlyErrorMessage(
          err,
          'No se pudo cargar tu perfil de personal en la base de datos.'
        )
      );
      setCurrentStaff(null);
    } finally {
      setLoadingData(false);
      setAuthReady(true);
    }
  }, []);

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      hadStaffDocRef.current = false;
      setFirebaseUser(user);
      setAuthError(null);

      if (!user) {
        unsubscribeAllListeners();
        setNeedsEmailVerification(false);
        setCurrentStaff(null);
        setOrders([]);
        setStaffList([]);
        setDailyReports([]);
        setAuditLogs([]);
        setCashRegister(null);
        setMenuDocs({});
        setAuthReady(true);
        return;
      }

      if (!user.emailVerified) {
        unsubscribeAllListeners();
        setNeedsEmailVerification(true);
        setCurrentStaff(null);
        setAuthReady(true);
        return;
      }

      setNeedsEmailVerification(false);
      await loadVerifiedStaffProfile(user);
    });

    return () => unsubscribe();
  }, [loadVerifiedStaffProfile, unsubscribeAllListeners]);

  // Live self-staff listener (runs even while 'pending' so Admin approval unlocks workspace in real time)
  useEffect(() => {
    if (!firebaseUser || needsEmailVerification || !firebaseUser.emailVerified) {
      return;
    }

    const isBootstrap =
      (firebaseUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    const cleanupSelf = registerListener(
      onSnapshot(
        doc(db, 'staff', firebaseUser.uid),
        (snap) => {
          if (!snap.exists()) {
            if (hadStaffDocRef.current && !isBootstrap) {
              hadStaffDocRef.current = false;
              unsubscribeAllListeners();
              void signOut(auth).catch(() => undefined);
              setCurrentStaff(null);
              setAuthError(
                'Tu solicitud de acceso fue rechazada o tu perfil fue eliminado por el Administrador.'
              );
            }
            return;
          }
          hadStaffDocRef.current = true;
          const d = snap.data();
          const nextRole = (isBootstrap ? 'admin' : d.role) as StaffRole;
          const nextActive = isBootstrap ? true : Boolean(d.active);
          setCurrentStaff((prev) => ({
            uid: firebaseUser.uid,
            displayName: String(d.displayName || prev?.displayName || 'Personal'),
            role: nextRole,
            active: nextActive,
            email: prev?.email || firebaseUser.email || '',
            createdAtMs: prev?.createdAtMs || tsToMs(d.createdAt),
            updatedAtMs: tsToMs(d.updatedAt),
          }));
          if (nextActive && nextRole !== 'pending') {
            setActiveWorkspaceState(nextRole);
          }
        },
        (error) => {
          if (!auth.currentUser) return;
          logFirestoreError(error, OperationType.GET, `staff/${firebaseUser.uid}`);
          notify(extractFriendlyErrorMessage(error), 'error');
        }
      )
    );

    return () => {
      cleanupSelf();
    };
  }, [firebaseUser, needsEmailVerification, registerListener, unsubscribeAllListeners, notify]);

  // Real-time operational Firestore listeners (ONLY when signed in & active staff)
  useEffect(() => {
    if (!firebaseUser || !currentStaff || !currentStaff.active || currentStaff.role === 'pending') {
      return;
    }

    const unsubscribers: (() => void)[] = [];
    const onListenerError = (op: OperationType, path: string) => (error: unknown) => {
      if (!auth.currentUser) return;
      logFirestoreError(error, op, path);
      notify(extractFriendlyErrorMessage(error), 'error');
    };

    // 1. Live Cash Register Open/Close State (real-time for all active staff)
    unsubscribers.push(
      registerListener(
        onSnapshot(
          doc(db, 'cash_register', 'current'),
          (snap) => {
            if (!snap.exists()) {
              setCashRegister(null);
              return;
            }
            const d = snap.data();
            setCashRegister({
              id: 'current',
              isOpen: Boolean(d.isOpen),
              dateKey: String(d.dateKey || getLocalDateKey()),
              openingCash: Number(d.openingCash || 0),
              openedByUid: String(d.openedByUid || ''),
              openedByName: String(d.openedByName || 'Administrador'),
              openedAtMs: tsToMs(d.openedAt),
              closedByUid: d.closedByUid ? String(d.closedByUid) : undefined,
              closedByName: d.closedByName ? String(d.closedByName) : undefined,
              closedAtMs: d.closedAt ? tsToMs(d.closedAt) : undefined,
              lastCountedCash: typeof d.lastCountedCash === 'number' ? d.lastCountedCash : undefined,
              lastCashDifference:
                typeof d.lastCashDifference === 'number' ? d.lastCashDifference : undefined,
              updatedAtMs: tsToMs(d.updatedAt),
            });
          },
          onListenerError(OperationType.GET, 'cash_register/current')
        )
      )
    );

    // 2. Live Orders listener
    const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200));
    unsubscribers.push(
      registerListener(
        onSnapshot(
          ordersQ,
          (snapshot) => {
            const list: Order[] = snapshot.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                folio: String(d.folio || ''),
                serviceType: d.serviceType as ServiceType,
                status: d.status as OrderStatus,
                dateKey: String(d.dateKey || getLocalDateKey()),
                waiterUid: String(d.waiterUid || ''),
                waiterName: String(d.waiterName || ''),
                kitchenUid: d.kitchenUid ? String(d.kitchenUid) : undefined,
                cashierUid: d.cashierUid ? String(d.cashierUid) : undefined,
                diners: Array.isArray(d.diners) ? (d.diners as OrderDiner[]) : [],
                items: Array.isArray(d.items) ? (d.items as OrderLineItem[]) : [],
                splitSharedEqually: Boolean(d.splitSharedEqually),
                subtotal: Number(d.subtotal || 0),
                tip: Number(d.tip || 0),
                total: Number(d.total || 0),
                paymentMethod: (d.paymentMethod || 'none') as PaymentMethod,
                amountReceived: Number(d.amountReceived || 0),
                changeGiven: Number(d.changeGiven || 0),
                hasDeliveryInfo: Boolean(d.hasDeliveryInfo),
                orderNotes: String(d.orderNotes || ''),
                createdAtMs: tsToMs(d.createdAt),
                updatedAtMs: tsToMs(d.updatedAt),
                paidAtMs: d.paidAt ? tsToMs(d.paidAt) : undefined,
              };
            });
            setOrders(list);
          },
          onListenerError(OperationType.LIST, 'orders')
        )
      )
    );

    // 3. Live Menu custom dishes, availability & price overrides
    unsubscribers.push(
      registerListener(
        onSnapshot(
          collection(db, 'menu_items'),
          (snapshot) => {
            const nextMap: Record<string, Partial<MenuItem>> = {};
            snapshot.docs.forEach((docSnap) => {
              const d = docSnap.data();
              nextMap[docSnap.id] = {
                id: docSnap.id,
                categoryId: d.categoryId as MenuCategoryId | undefined,
                name: typeof d.name === 'string' ? d.name : undefined,
                desc: typeof d.desc === 'string' ? d.desc : undefined,
                price: typeof d.price === 'number' ? d.price : undefined,
                available: typeof d.available === 'boolean' ? d.available : true,
                station: d.station as KitchenStation | undefined,
              };
            });
            setMenuDocs(nextMap);
          },
          onListenerError(OperationType.LIST, 'menu_items')
        )
      )
    );

    // 4. Daily reports, Staff Directory & Audit Logs (Admin ONLY)
    let isEffectActive = true;
    let staffSnapshotSeq = 0;

    if (currentStaff.role === 'admin') {
      const reportsQ = query(collection(db, 'daily_reports'), orderBy('dateKey', 'desc'), limit(31));
      unsubscribers.push(
        registerListener(
          onSnapshot(
            reportsQ,
            (snapshot) => {
              setDailyReports(
                snapshot.docs.map((docSnap) => {
                  const d = docSnap.data();
                  return {
                    dateKey: String(d.dateKey || docSnap.id),
                    totalSales: Number(d.totalSales || 0),
                    totalTips: Number(d.totalTips || 0),
                    orderCount: Number(d.orderCount || 0),
                    cancelledCount: Number(d.cancelledCount || 0),
                    cashTotal: Number(d.cashTotal || 0),
                    cardTotal: Number(d.cardTotal || 0),
                    transferTotal: Number(d.transferTotal || 0),
                    openingCash: Number(d.openingCash || 0),
                    countedCash: Number(d.countedCash || 0),
                    cashDifference: Number(d.cashDifference || 0),
                    generatedByUid: String(d.generatedByUid || ''),
                    generatedByName: String(d.generatedByName || ''),
                    updatedAtMs: tsToMs(d.updatedAt),
                  };
                })
              );
            },
            onListenerError(OperationType.LIST, 'daily_reports')
          )
        )
      );

      unsubscribers.push(
        registerListener(
          onSnapshot(
            collection(db, 'staff'),
            async (snapshot) => {
              const currentSeq = ++staffSnapshotSeq;
              const profiles: StaffProfile[] = snapshot.docs.map((docSnap) => {
                const d = docSnap.data();
                return {
                  uid: docSnap.id,
                  displayName: String(d.displayName || 'Personal'),
                  role: d.role as StaffRole,
                  active: Boolean(d.active),
                  createdAtMs: tsToMs(d.createdAt),
                  updatedAtMs: tsToMs(d.updatedAt),
                };
              });

              const enriched = await Promise.all(
                profiles.map(async (p) => {
                  try {
                    const contactSnap = await getDoc(doc(db, 'staff', p.uid, 'private', 'contact'));
                    if (contactSnap.exists()) {
                      return { ...p, email: String(contactSnap.data().email || '') };
                    }
                  } catch {
                    // Ignore missing private contact doc
                  }
                  return p;
                })
              );
              if (!isEffectActive || currentSeq !== staffSnapshotSeq || !auth.currentUser) {
                return;
              }
              setStaffList(enriched);
            },
            onListenerError(OperationType.LIST, 'staff')
          )
        )
      );

      const auditQ = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(60));
      unsubscribers.push(
        registerListener(
          onSnapshot(
            auditQ,
            (snapshot) => {
              setAuditLogs(
                snapshot.docs.map((docSnap) => {
                  const d = docSnap.data();
                  return {
                    id: docSnap.id,
                    action: d.action as AuditAction,
                    actorUid: String(d.actorUid || ''),
                    actorRole: d.actorRole as ActiveWorkspaceRole,
                    targetId: String(d.targetId || ''),
                    summary: String(d.summary || ''),
                    createdAtMs: tsToMs(d.createdAt),
                  };
                })
              );
            },
            onListenerError(OperationType.LIST, 'audit_logs')
          )
        )
      );
    }

    return () => {
      isEffectActive = false;
      unsubscribers.forEach((u) => u());
    };
  }, [firebaseUser, currentStaff?.uid, currentStaff?.role, currentStaff?.active, registerListener, notify]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setAuthError(emailCheck.error || 'Correo inválido.');
      return false;
    }
    const passCheck = validatePasswordForSignIn(password);
    if (!passCheck.valid) {
      setAuthError(passCheck.error || 'Contraseña inválida.');
      return false;
    }

    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    }
  }, []);

  const registerWithEmail = useCallback(
    async (
      displayName: string,
      email: string,
      password: string,
      confirmPassword: string
    ): Promise<boolean> => {
      setAuthError(null);
      const check = validateStaffRegistration({
        displayName,
        email,
        password,
        confirmPassword,
      });
      if (!check.valid) {
        setAuthError(check.error || 'Revisa los datos del formulario.');
        return false;
      }

      const cleanName = safePersonName(displayName, 'Personal');
      const cleanEmail = normalizeEmail(email);
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: cleanName });
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // User can click resend on the verification screen
        }
        setNeedsEmailVerification(true);
        notify('Cuenta creada. Revisa tu correo para verificar tu acceso.', 'success');
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        return false;
      }
    },
    [notify]
  );

  const sendPasswordReset = useCallback(
    async (email: string): Promise<{ ok: boolean; message: string }> => {
      setAuthError(null);
      const check = validateEmail(email);
      if (!check.valid) {
        return { ok: false, message: check.error || 'Correo inválido.' };
      }
      try {
        await sendPasswordResetEmail(auth, normalizeEmail(email));
        return {
          ok: true,
          message:
            'Si el correo está registrado, enviamos un enlace para restablecer tu contraseña.',
        };
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: unknown }).code || '')
            : '';
        // Prevent user enumeration on user-not-found
        if (code === 'auth/user-not-found') {
          return {
            ok: true,
            message:
              'Si el correo está registrado, enviamos un enlace para restablecer tu contraseña.',
          };
        }
        return { ok: false, message: mapFirebaseAuthError(err) };
      }
    },
    []
  );

  const resendVerificationEmail = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const user = auth.currentUser;
    if (!user) {
      return { ok: false, message: 'No hay sesión activa para reenviar verificación.' };
    }
    try {
      await sendEmailVerification(user);
      return {
        ok: true,
        message: 'Enviamos un nuevo enlace de verificación. Revisa tu bandeja de entrada o spam.',
      };
    } catch (err) {
      return { ok: false, message: mapFirebaseAuthError(err) };
    }
  }, []);

  const reloadEmailVerification = useCallback(async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    try {
      await user.reload();
      await user.getIdToken(true);
      if (user.emailVerified) {
        setNeedsEmailVerification(false);
        await loadVerifiedStaffProfile(user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [loadVerifiedStaffProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    }
  }, []);

  const exitSession = useCallback(async () => {
    // Detach all Firestore real-time listeners synchronously BEFORE signOut
    // to prevent post-signout permission-denied callbacks.
    unsubscribeAllListeners();
    try {
      await signOut(auth);
    } catch (err) {
      logFirestoreError(err, OperationType.WRITE, 'auth/signOut');
    } finally {
      setFirebaseUser(null);
      setNeedsEmailVerification(false);
      setAuthError(null);
      setCurrentStaff(null);
      setOrders([]);
      setStaffList([]);
      setAuditLogs([]);
      setDailyReports([]);
      setCashRegister(null);
      setMenuDocs({});
      setAuthReady(true);
    }
  }, [unsubscribeAllListeners]);

  const createOrder = useCallback(
    async (payload: CreateOrderPayload): Promise<Order> => {
      if (!currentStaff || !currentStaff.active || currentStaff.role !== 'mesero') {
        throw new Error('Solo el perfil Mesero puede tomar órdenes de los clientes.');
      }

      const rawDiners: OrderDiner[] = payload.diners.slice(0, 12).map((d, idx) => ({
        id: d.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `diner-${idx + 1}`,
        label: safePersonName(d.label, 'Comensal'),
        isShared: Boolean(d.isShared),
      }));
      const sanitizedDiners =
        rawDiners.length > 0
          ? rawDiners
          : [{ id: 'diner-1', label: 'Persona 1', isShared: false }];

      const sanitizedItems: OrderLineItem[] = payload.items
        .slice(0, 50)
        .map((item, idx) => ({
          lineId: item.lineId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `ln-${idx + 1}`,
          dishId: item.dishId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `dish-${idx + 1}`,
          name: sanitizeText(item.name, 80) || 'Platillo',
          categoryId: item.categoryId,
          station: item.station,
          unitPrice: roundMoney(item.unitPrice),
          qty: Math.min(99, Math.max(1, Math.floor(item.qty))),
          dinerId:
            item.dinerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || sanitizedDiners[0].id,
          notes: sanitizeText(item.notes, MAX_LINE_NOTES_LENGTH),
        }))
        .filter((item) => item.unitPrice >= 1);

      const subtotal = calculateItemsSubtotal(sanitizedItems);
      if (sanitizedItems.length === 0 || subtotal < 1) {
        throw new Error('Agrega al menos un platillo válido antes de enviar la comanda.');
      }
      if (subtotal > 250000) {
        throw new Error('El subtotal máximo permitido por orden es de $250,000 MXN.');
      }

      const orderId = makeDocId('ord');
      const folio = generateOrderFolio();
      const dateKey = getLocalDateKey();
      const now = Date.now();
      const hasDeliveryInfo = payload.serviceType === 'Servicio a Domicilio';
      const safeOrderNotes = sanitizeText(payload.orderNotes, MAX_ORDER_NOTES_LENGTH);
      const safeWaiterName = safePersonName(currentStaff.displayName, 'Mesero');

      const rawCustomerName = sanitizeText(payload.customerName, MAX_CUSTOMER_NAME_LENGTH);
      const fallbackCustomerName = safePersonName(sanitizedDiners[0]?.label, 'Cliente');
      const safeCustomer: OrderPrivateCustomer | null =
        payload.customerName.trim() || payload.phone.trim() || hasDeliveryInfo
          ? {
              orderId,
              customerName: rawCustomerName.length >= 2 ? rawCustomerName : fallbackCustomerName,
              phone: sanitizeText(payload.phone, MAX_PHONE_LENGTH),
              street: sanitizeText(payload.street, MAX_STREET_LENGTH),
              colony: sanitizeText(payload.colony, MAX_COLONY_LENGTH),
              reference: sanitizeText(payload.reference, MAX_REFERENCE_LENGTH),
              waiterUid: currentStaff.uid,
            }
          : null;

      const newOrder: Order = {
        id: orderId,
        folio,
        serviceType: payload.serviceType,
        status: 'pending',
        dateKey,
        waiterUid: currentStaff.uid,
        waiterName: safeWaiterName,
        diners: sanitizedDiners,
        items: sanitizedItems,
        splitSharedEqually: Boolean(payload.splitSharedEqually),
        subtotal,
        tip: 0,
        total: subtotal,
        paymentMethod: 'none',
        amountReceived: 0,
        changeGiven: 0,
        hasDeliveryInfo,
        orderNotes: safeOrderNotes,
        createdAtMs: now,
        updatedAtMs: now,
        privateCustomer: safeCustomer,
      };

      const orderPath = `orders/${orderId}`;
      try {
        const batch = writeBatch(db);
        const orderRef = doc(db, 'orders', orderId);
        batch.set(orderRef, {
          folio: newOrder.folio,
          serviceType: newOrder.serviceType,
          status: 'pending',
          dateKey: newOrder.dateKey,
          waiterUid: newOrder.waiterUid,
          waiterName: newOrder.waiterName,
          diners: newOrder.diners,
          items: newOrder.items,
          splitSharedEqually: newOrder.splitSharedEqually,
          subtotal: newOrder.subtotal,
          tip: 0,
          total: newOrder.total,
          paymentMethod: 'none',
          amountReceived: 0,
          changeGiven: 0,
          hasDeliveryInfo: newOrder.hasDeliveryInfo,
          orderNotes: newOrder.orderNotes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (safeCustomer) {
          batch.set(doc(db, 'orders', orderId, 'private', 'customer'), {
            orderId: safeCustomer.orderId,
            customerName: safeCustomer.customerName,
            phone: safeCustomer.phone,
            street: safeCustomer.street,
            colony: safeCustomer.colony,
            reference: safeCustomer.reference,
            waiterUid: safeCustomer.waiterUid,
            createdAt: serverTimestamp(),
          });
        }

        await batch.commit();
        await writeAuditLog(
          'ORDER_CREATED',
          orderId,
          `Nueva comanda ${folio} (${payload.serviceType}) por $${subtotal.toFixed(2)}`
        );
        notify(`Comanda ${folio} enviada en tiempo real a Cocina.`, 'success');
        return newOrder;
      } catch (err) {
        logFirestoreError(err, OperationType.CREATE, orderPath);
        throw new Error(
          extractFriendlyErrorMessage(err, 'No se pudo enviar la comanda a la base de datos.')
        );
      }
    },
    [currentStaff, notify, writeAuditLog]
  );

  const appendItemsToOrder = useCallback(
    async (payload: AppendOrderPayload): Promise<void> => {
      const target = orders.find((o) => o.id === payload.orderId);
      if (!target || !currentStaff || currentStaff.role !== 'mesero') {
        throw new Error('Solo el perfil Mesero puede modificar platillos de una comanda.');
      }

      const rawDiners = payload.diners.slice(0, 12).map((d, idx) => ({
        id: d.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `diner-${idx + 1}`,
        label: safePersonName(d.label, 'Comensal'),
        isShared: Boolean(d.isShared),
      }));
      const sanitizedDiners =
        rawDiners.length > 0
          ? rawDiners
          : [{ id: 'diner-1', label: 'Persona 1', isShared: false }];

      const sanitizedItems = payload.items
        .slice(0, 50)
        .map((item, idx) => ({
          lineId: item.lineId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `ln-${idx + 1}`,
          dishId: item.dishId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `dish-${idx + 1}`,
          name: sanitizeText(item.name, 80) || 'Platillo',
          categoryId: item.categoryId,
          station: item.station,
          unitPrice: roundMoney(item.unitPrice),
          qty: Math.min(99, Math.max(1, Math.floor(item.qty))),
          dinerId:
            item.dinerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || sanitizedDiners[0].id,
          notes: sanitizeText(item.notes, MAX_LINE_NOTES_LENGTH),
        }))
        .filter((item) => item.unitPrice >= 1);

      if (target.status !== 'pending' && target.status !== 'preparing') {
        throw new Error('Solo se pueden agregar platillos a órdenes en espera o en preparación.');
      }

      const subtotal = calculateItemsSubtotal(sanitizedItems);
      if (sanitizedItems.length === 0 || subtotal < 1) {
        throw new Error('La comanda debe conservar al menos un platillo válido.');
      }
      if (subtotal > 250000) {
        throw new Error('El subtotal máximo permitido por orden es de $250,000 MXN.');
      }
      if (target.status === 'preparing' && subtotal < target.subtotal) {
        throw new Error(
          'Esta orden ya está en preparación en cocina; solo puedes agregar platillos, no reducirlos.'
        );
      }
      const total = roundMoney(subtotal + target.tip);
      const safeOrderNotes = sanitizeText(payload.orderNotes, MAX_ORDER_NOTES_LENGTH);

      const path = `orders/${payload.orderId}`;
      try {
        await updateDoc(doc(db, 'orders', payload.orderId), {
          diners: sanitizedDiners,
          items: sanitizedItems,
          splitSharedEqually: payload.splitSharedEqually,
          subtotal,
          total,
          orderNotes: safeOrderNotes,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'ORDER_UPDATED',
          payload.orderId,
          `Actualizó comanda ${target.folio} ($${subtotal.toFixed(2)})`
        );
        notify(`Comanda ${target.folio} actualizada en tiempo real.`, 'success');
      } catch (err) {
        logFirestoreError(err, OperationType.UPDATE, path);
        throw new Error(extractFriendlyErrorMessage(err, 'No se pudo actualizar la comanda.'));
      }
    },
    [orders, currentStaff, notify, writeAuditLog]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, nextStatus: OrderStatus): Promise<void> => {
      const target = orders.find((o) => o.id === orderId);
      if (!target || !currentStaff || !currentStaff.active || currentStaff.role === 'pending') return;

      const effectiveRole: ActiveWorkspaceRole = currentStaff.role;

      if (nextStatus === 'cancelled' && !canCancelOrder(effectiveRole, target.status)) {
        notify('Solo el Administrador puede cancelar pedidos activos.', 'error');
        return;
      }

      if (!canTransitionOrderStatus(effectiveRole, target.status, nextStatus)) {
        notify('Transición de estado no permitida para tu perfil.', 'error');
        return;
      }

      const isKitchenStep = nextStatus === 'preparing' || nextStatus === 'ready';
      const path = `orders/${orderId}`;
      try {
        const updatePayload: Record<string, unknown> = {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        };
        if (isKitchenStep) {
          updatePayload.kitchenUid = currentStaff.uid;
        }
        await updateDoc(doc(db, 'orders', orderId), updatePayload);
        await writeAuditLog(
          nextStatus === 'cancelled' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
          orderId,
          `${target.folio} (${target.serviceType}) cambió a ${nextStatus}`
        );
        notify(`Orden ${target.folio} actualizada en tiempo real.`, 'success');
      } catch (err) {
        logFirestoreError(err, OperationType.UPDATE, path);
        notify(
          extractFriendlyErrorMessage(err, 'No se pudo actualizar el estado de la orden.'),
          'error'
        );
      }
    },
    [orders, currentStaff, notify, writeAuditLog]
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason: string): Promise<{ ok: boolean; message: string }> => {
      if (!currentStaff || !currentStaff.active || currentStaff.role !== 'admin') {
        const msg = 'Solo el Administrador puede cancelar pedidos tomados por meseros.';
        notify(msg, 'error');
        return { ok: false, message: msg };
      }

      const target = orders.find((o) => o.id === orderId);
      if (!target) {
        return { ok: false, message: 'No se encontró el pedido seleccionado.' };
      }

      if (!canCancelOrder(currentStaff.role, target.status)) {
        const msg =
          target.status === 'paid'
            ? 'No se puede cancelar un pedido que ya fue cobrado en caja.'
            : 'Este pedido ya fue cancelado previamente.';
        return { ok: false, message: msg };
      }

      const reasonCheck = validateCancellationReason(reason);
      if (!reasonCheck.valid) {
        return {
          ok: false,
          message: reasonCheck.error || 'Ingresa un motivo válido de cancelación.',
        };
      }

      const adminName = safePersonName(currentStaff.displayName, 'Administrador');
      const path = `orders/${orderId}`;
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });

        const auditSummary = buildCancellationAuditSummary({
          adminName,
          folio: target.folio,
          serviceType: target.serviceType,
          waiterName: target.waiterName,
          total: target.total,
          reason: reasonCheck.reason,
        });
        await writeAuditLog('ORDER_CANCELLED', orderId, auditSummary);

        const successMsg = `Pedido ${target.folio} (${target.serviceType} · Mesero: ${target.waiterName}) cancelado por Administrador.`;
        notify(successMsg, 'success');
        return { ok: true, message: successMsg };
      } catch (err) {
        logFirestoreError(err, OperationType.UPDATE, path);
        const errMsg = extractFriendlyErrorMessage(err, 'No se pudo cancelar el pedido.');
        notify(errMsg, 'error');
        return { ok: false, message: errMsg };
      }
    },
    [orders, currentStaff, notify, writeAuditLog]
  );

  const processOrderPayment = useCallback(
    async (payload: ProcessPaymentPayload): Promise<Order> => {
      const target = orders.find((o) => o.id === payload.orderId);
      if (!target || !currentStaff || currentStaff.role !== 'cajero') {
        throw new Error('Solo el perfil Cajero puede cobrar cuentas de clientes.');
      }

      if (!cashRegister?.isOpen) {
        throw new Error(
          'La caja está cerrada. Espera a que el Administrador abra la caja para cobrar.'
        );
      }

      if (!canTransitionOrderStatus('cajero', target.status, 'paid')) {
        throw new Error('Esta orden aún no está lista para cobro o ya fue pagada.');
      }

      const calc = calculateCheckoutPayment({
        subtotal: target.subtotal,
        tip: payload.tip,
        paymentMethod: payload.paymentMethod,
        amountReceivedInput: payload.amountReceived,
      });

      if (!calc.valid) {
        throw new Error(calc.error || 'Error validando el pago.');
      }

      const now = Date.now();
      const updatedOrder: Order = {
        ...target,
        status: 'paid',
        paymentMethod: payload.paymentMethod,
        tip: calc.tip,
        total: calc.total,
        amountReceived: calc.amountReceived,
        changeGiven: calc.changeGiven,
        cashierUid: currentStaff.uid,
        paidAtMs: now,
        updatedAtMs: now,
      };

      const path = `orders/${payload.orderId}`;
      try {
        await updateDoc(doc(db, 'orders', payload.orderId), {
          status: 'paid',
          paymentMethod: payload.paymentMethod,
          tip: calc.tip,
          total: calc.total,
          amountReceived: calc.amountReceived,
          changeGiven: calc.changeGiven,
          cashierUid: currentStaff.uid,
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'ORDER_PAID',
          payload.orderId,
          `Cobro ${target.folio} (${target.serviceType}) por $${calc.total.toFixed(2)} vía ${payload.paymentMethod}`
        );
        notify(`Pago de ${target.folio} guardado en base de datos.`, 'success');
        return updatedOrder;
      } catch (err) {
        logFirestoreError(err, OperationType.UPDATE, path);
        throw new Error(extractFriendlyErrorMessage(err, 'No se pudo procesar el cobro.'));
      }
    },
    [orders, currentStaff, cashRegister?.isOpen, notify, writeAuditLog]
  );

  const loadOrderPrivateCustomer = useCallback(
    async (orderId: string): Promise<OrderPrivateCustomer | null> => {
      const existing = orders.find((o) => o.id === orderId);
      if (
        !currentStaff ||
        (currentStaff.role !== 'admin' &&
          currentStaff.role !== 'cajero' &&
          existing?.waiterUid !== currentStaff.uid)
      ) {
        return null;
      }
      const path = `orders/${orderId}/private/customer`;
      try {
        const snap = await getDoc(doc(db, 'orders', orderId, 'private', 'customer'));
        if (!snap.exists()) return null;
        const d = snap.data();
        return {
          orderId,
          customerName: String(d.customerName || ''),
          phone: String(d.phone || ''),
          street: String(d.street || ''),
          colony: String(d.colony || ''),
          reference: String(d.reference || ''),
          waiterUid: String(d.waiterUid || ''),
        };
      } catch (err) {
        logFirestoreError(err, OperationType.GET, path);
        return null;
      }
    },
    [orders, currentStaff]
  );

  const addMenuItem = useCallback(
    async (payload: CreateMenuItemPayload): Promise<{ ok: boolean; message: string }> => {
      if (!currentStaff || currentStaff.role !== 'admin') {
        return { ok: false, message: 'Solo el Administrador puede agregar platillos al menú.' };
      }

      const validationError = validateNewMenuItemInput(payload);
      if (validationError) {
        return { ok: false, message: validationError };
      }

      const cleanName = sanitizeText(payload.name, MAX_MENU_NAME_LENGTH);
      const cleanDesc = sanitizeText(payload.desc, MAX_MENU_DESC_LENGTH);
      const safePrice = roundMoney(payload.price);
      const itemId = makeDocId('dish');

      const path = `menu_items/${itemId}`;
      try {
        await setDoc(doc(db, 'menu_items', itemId), {
          id: itemId,
          categoryId: payload.categoryId,
          name: cleanName,
          desc: cleanDesc,
          price: safePrice,
          available: true,
          station: payload.station,
          updatedBy: currentStaff.uid,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'MENU_UPDATED',
          itemId,
          `Nuevo platillo agregado: ${cleanName} ($${safePrice.toFixed(2)})`
        );
        notify(`Platillo "${cleanName}" agregado en Firebase.`, 'success');
        return {
          ok: true,
          message: `Platillo "${cleanName}" publicado en tiempo real para Meseros.`,
        };
      } catch (err) {
        logFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          message: extractFriendlyErrorMessage(err, 'No se pudo guardar el platillo en el menú.'),
        };
      }
    },
    [currentStaff, notify, writeAuditLog]
  );

  const deleteMenuItem = useCallback(
    async (itemId: string): Promise<void> => {
      const item = menuItems.find((i) => i.id === itemId);
      if (!item || !item.isCustom || !currentStaff || currentStaff.role !== 'admin') return;

      const path = `menu_items/${itemId}`;
      try {
        await deleteDoc(doc(db, 'menu_items', itemId));
        await writeAuditLog('MENU_UPDATED', itemId, `Platillo eliminado del menú: ${item.name}`);
        notify(`Platillo "${item.name}" eliminado de Firebase.`, 'info');
      } catch (err) {
        logFirestoreError(err, OperationType.DELETE, path);
        notify(
          extractFriendlyErrorMessage(err, 'No se pudo eliminar el platillo del menú.'),
          'error'
        );
      }
    },
    [menuItems, currentStaff, notify, writeAuditLog]
  );

  const toggleMenuAvailability = useCallback(
    async (itemId: string, available: boolean): Promise<void> => {
      const item = menuItems.find((i) => i.id === itemId);
      if (!item || !currentStaff || currentStaff.role !== 'admin') return;

      const path = `menu_items/${itemId}`;
      try {
        await setDoc(doc(db, 'menu_items', itemId), {
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          desc: sanitizeText(item.desc, MAX_MENU_DESC_LENGTH),
          price: item.price,
          available,
          station: item.station,
          updatedBy: currentStaff.uid,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'MENU_UPDATED',
          itemId,
          `${item.name} marcado como ${available ? 'Disponible' : 'Agotado'}`
        );
        notify(`${item.name} actualizado en tiempo real.`, 'success');
      } catch (err) {
        logFirestoreError(err, OperationType.WRITE, path);
        notify(
          extractFriendlyErrorMessage(err, 'No se pudo actualizar la disponibilidad del platillo.'),
          'error'
        );
      }
    },
    [menuItems, currentStaff, notify, writeAuditLog]
  );

  const updateMenuPrice = useCallback(
    async (itemId: string, price: number): Promise<boolean> => {
      const item = menuItems.find((i) => i.id === itemId);
      const safePrice = roundMoney(price);
      if (!item || !currentStaff || currentStaff.role !== 'admin') return false;
      if (!Number.isFinite(price) || safePrice < 1 || safePrice > 50000) {
        notify('El precio debe estar entre $1 y $50,000 MXN.', 'error');
        return false;
      }

      const path = `menu_items/${itemId}`;
      try {
        await setDoc(doc(db, 'menu_items', itemId), {
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          desc: sanitizeText(item.desc, MAX_MENU_DESC_LENGTH),
          price: safePrice,
          available: item.available,
          station: item.station,
          updatedBy: currentStaff.uid,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'MENU_UPDATED',
          itemId,
          `Precio de ${item.name} actualizado a $${safePrice.toFixed(2)}`
        );
        notify(`Precio de ${item.name} actualizado en tiempo real.`, 'success');
        return true;
      } catch (err) {
        logFirestoreError(err, OperationType.WRITE, path);
        notify(extractFriendlyErrorMessage(err, 'No se pudo actualizar el precio.'), 'error');
        return false;
      }
    },
    [menuItems, currentStaff, notify, writeAuditLog]
  );

  const createStaffAccount = useCallback(
    async (payload: CreateStaffAccountPayload): Promise<{ ok: boolean; message: string }> => {
      if (!currentStaff || currentStaff.role !== 'admin') {
        return { ok: false, message: 'Solo un Administrador puede dar de alta cuentas de personal.' };
      }

      const check = validateStaffRegistration({
        displayName: payload.displayName,
        email: payload.email,
        password: payload.password,
      });
      if (!check.valid) {
        return { ok: false, message: check.error || 'Revisa los datos del nuevo empleado.' };
      }

      const cleanName = safePersonName(payload.displayName, 'Personal');
      const cleanEmail = normalizeEmail(payload.email);

      try {
        const { uid, email: createdEmail } = await provisionStaffAuthAccount(
          cleanEmail,
          payload.password,
          cleanName
        );

        const batch = writeBatch(db);
        batch.set(doc(db, 'staff', uid), {
          uid,
          displayName: cleanName,
          role: payload.role,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'staff', uid, 'private', 'contact'), {
          uid,
          email: sanitizeText(createdEmail, 160),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

        await writeAuditLog(
          'ROLE_UPDATED',
          uid,
          `Alta de personal con correo/contraseña: ${cleanName} (${payload.role})`
        );
        notify(`Cuenta creada para ${cleanName}. Se envió correo de verificación.`, 'success');
        return {
          ok: true,
          message: `Cuenta creada para ${cleanName} (${payload.role}). El empleado solo debe verificar su correo para entrar con su correo y contraseña.`,
        };
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: unknown }).code || '')
            : '';
        if (code.startsWith('auth/')) {
          return { ok: false, message: mapFirebaseAuthError(err) };
        }
        logFirestoreError(err, OperationType.CREATE, 'staff');
        return {
          ok: false,
          message: extractFriendlyErrorMessage(err, 'No se pudo crear la cuenta de personal.'),
        };
      }
    },
    [currentStaff, writeAuditLog, notify]
  );

  const updateStaffRole = useCallback(
    async (uid: string, role: StaffRole, active: boolean): Promise<void> => {
      if (!currentStaff || currentStaff.role !== 'admin') return;

      const path = `staff/${uid}`;
      try {
        await updateDoc(doc(db, 'staff', uid), {
          role,
          active,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'ROLE_UPDATED',
          uid,
          `Rol actualizado a ${role} (activo: ${active ? 'Sí' : 'No'})`
        );
        notify('Permisos de personal actualizados en Firebase.', 'success');
      } catch (err) {
        logFirestoreError(err, OperationType.UPDATE, path);
        notify(
          extractFriendlyErrorMessage(err, 'No se pudieron actualizar los permisos del usuario.'),
          'error'
        );
      }
    },
    [currentStaff, notify, writeAuditLog]
  );

  const deletePendingStaff = useCallback(
    async (uid: string): Promise<void> => {
      if (!currentStaff || currentStaff.role !== 'admin' || uid === currentStaff.uid) return;

      const path = `staff/${uid}`;
      try {
        await deleteDoc(doc(db, 'staff', uid, 'private', 'contact')).catch(() => undefined);
        await deleteDoc(doc(db, 'staff', uid));
        await writeAuditLog(
          'ROLE_UPDATED',
          uid,
          `Solicitud de registro rechazada/eliminada (${uid})`
        );
        notify('Solicitud de registro eliminada de Firestore.', 'info');
      } catch (err) {
        logFirestoreError(err, OperationType.DELETE, path);
        notify(
          extractFriendlyErrorMessage(err, 'No se pudo eliminar la solicitud de registro.'),
          'error'
        );
      }
    },
    [currentStaff, notify, writeAuditLog]
  );

  const openCashRegister = useCallback(
    async (openingCash: number): Promise<CashRegisterState> => {
      if (!currentStaff || currentStaff.role !== 'admin') {
        throw new Error('Solo el Administrador puede abrir la caja.');
      }

      const safeOpening = roundMoney(openingCash);
      if (!Number.isFinite(openingCash) || safeOpening < 0 || safeOpening > 1000000) {
        throw new Error('El fondo inicial debe estar entre $0 y $1,000,000 MXN.');
      }

      const dateKey = getLocalDateKey();
      const now = Date.now();
      const adminName = safePersonName(currentStaff.displayName, 'Administrador');
      const nextState: CashRegisterState = {
        id: 'current',
        isOpen: true,
        dateKey,
        openingCash: safeOpening,
        openedByUid: currentStaff.uid,
        openedByName: adminName,
        openedAtMs: now,
        updatedAtMs: now,
      };

      const path = 'cash_register/current';
      try {
        await setDoc(doc(db, 'cash_register', 'current'), {
          id: 'current',
          isOpen: true,
          dateKey,
          openingCash: safeOpening,
          openedByUid: currentStaff.uid,
          openedByName: adminName,
          openedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'CASH_REGISTER_OPENED',
          dateKey,
          `Caja abierta por ${adminName} con fondo inicial de $${safeOpening.toFixed(2)}`
        );
        notify(`Caja abierta en tiempo real con fondo $${safeOpening.toFixed(2)}.`, 'success');
        return nextState;
      } catch (err) {
        logFirestoreError(err, OperationType.WRITE, path);
        throw new Error(extractFriendlyErrorMessage(err, 'No se pudo abrir la caja.'));
      }
    },
    [currentStaff, notify, writeAuditLog]
  );

  const closeCashRegisterAndSaveCut = useCallback(
    async (payload: CloseCashRegisterPayload): Promise<DailyReport> => {
      if (!currentStaff || currentStaff.role !== 'admin') {
        throw new Error('Solo el Administrador puede cerrar la caja y emitir el corte.');
      }
      if (!cashRegister?.isOpen) {
        throw new Error('La caja ya se encuentra cerrada.');
      }

      const summary = computeDailySalesSummary(orders, payload.dateKey);
      const reconciliation = calculateCashCutReconciliation({
        openingCash: cashRegister.openingCash,
        cashSales: summary.cashTotal,
        countedCash: payload.countedCash,
      });

      if (!reconciliation.valid) {
        throw new Error(reconciliation.error || 'Verifica los montos del arqueo de caja.');
      }

      const adminName = safePersonName(currentStaff.displayName, 'Administrador');
      const now = Date.now();
      const report: DailyReport = {
        dateKey: payload.dateKey,
        totalSales: summary.totalRevenue,
        totalTips: summary.totalTips,
        orderCount: summary.paidOrderCount,
        cancelledCount: summary.cancelledOrderCount,
        cashTotal: summary.cashTotal,
        cardTotal: summary.cardTotal,
        transferTotal: summary.transferTotal,
        openingCash: reconciliation.openingCash,
        countedCash: reconciliation.countedCash,
        cashDifference: reconciliation.difference,
        generatedByUid: currentStaff.uid,
        generatedByName: adminName,
        updatedAtMs: now,
      };

      const path = `cash_register/current | daily_reports/${payload.dateKey}`;
      try {
        const regRef = doc(db, 'cash_register', 'current');
        const repRef = doc(db, 'daily_reports', payload.dateKey);
        const existingRep = await getDoc(repRef);

        const batch = writeBatch(db);
        batch.update(regRef, {
          isOpen: false,
          closedByUid: currentStaff.uid,
          closedByName: adminName,
          closedAt: serverTimestamp(),
          lastCountedCash: reconciliation.countedCash,
          lastCashDifference: reconciliation.difference,
          updatedAt: serverTimestamp(),
        });

        if (existingRep.exists()) {
          batch.update(repRef, {
            totalSales: report.totalSales,
            totalTips: report.totalTips,
            orderCount: report.orderCount,
            cancelledCount: report.cancelledCount,
            cashTotal: report.cashTotal,
            cardTotal: report.cardTotal,
            transferTotal: report.transferTotal,
            openingCash: report.openingCash,
            countedCash: report.countedCash,
            cashDifference: report.cashDifference,
            generatedByUid: report.generatedByUid,
            generatedByName: report.generatedByName,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(repRef, {
            dateKey: report.dateKey,
            totalSales: report.totalSales,
            totalTips: report.totalTips,
            orderCount: report.orderCount,
            cancelledCount: report.cancelledCount,
            cashTotal: report.cashTotal,
            cardTotal: report.cardTotal,
            transferTotal: report.transferTotal,
            openingCash: report.openingCash,
            countedCash: report.countedCash,
            cashDifference: report.cashDifference,
            generatedByUid: report.generatedByUid,
            generatedByName: report.generatedByName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        await writeAuditLog(
          'CASH_REGISTER_CLOSED',
          payload.dateKey,
          `Caja cerrada por ${adminName} (${payload.dateKey}, $${report.totalSales.toFixed(2)}, ${reconciliation.statusLabel})`
        );
        notify(`Caja cerrada en Firebase y Corte PDF ${payload.dateKey} generado.`, 'success');
        return report;
      } catch (err) {
        logFirestoreError(err, OperationType.WRITE, path);
        throw new Error(extractFriendlyErrorMessage(err, 'No se pudo cerrar la caja.'));
      }
    },
    [currentStaff, cashRegister, orders, notify, writeAuditLog]
  );

  const value = useMemo<PosContextValue>(
    () => ({
      authReady,
      firebaseUser,
      needsEmailVerification,
      currentStaff,
      activeWorkspace,
      canAccessWorkspace,
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
      orders,
      menuItems,
      staffList,
      cashRegister,
      dailyReports,
      auditLogs,
      createOrder,
      appendItemsToOrder,
      updateOrderStatus,
      cancelOrder,
      processOrderPayment,
      loadOrderPrivateCustomer,
      addMenuItem,
      deleteMenuItem,
      toggleMenuAvailability,
      updateMenuPrice,
      createStaffAccount,
      updateStaffRole,
      deletePendingStaff,
      openCashRegister,
      closeCashRegisterAndSaveCut,
      toast,
      notify,
    }),
    [
      authReady,
      firebaseUser,
      needsEmailVerification,
      currentStaff,
      activeWorkspace,
      canAccessWorkspace,
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
      orders,
      menuItems,
      staffList,
      cashRegister,
      dailyReports,
      auditLogs,
      createOrder,
      appendItemsToOrder,
      updateOrderStatus,
      cancelOrder,
      processOrderPayment,
      loadOrderPrivateCustomer,
      addMenuItem,
      deleteMenuItem,
      toggleMenuAvailability,
      updateMenuPrice,
      createStaffAccount,
      updateStaffRole,
      deletePendingStaff,
      openCashRegister,
      closeCashRegisterAndSaveCut,
      toast,
      notify,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) {
    throw new Error('usePos must be used within a PosProvider');
  }
  return ctx;
}
