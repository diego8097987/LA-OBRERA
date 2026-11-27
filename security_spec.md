# Security Specification — LA OBRERA Grill Asadero POS

## 1. Core Data Invariants
1. **Zero Anonymous/Unverified Access**: Every read and write requires `request.auth != null && request.auth.token.email_verified == true`.
2. **No Self-Assigned Roles**: Newly registered staff documents MUST initialize with `role == 'pending'` and `active == false` unless the caller is the verified bootstrap admin (`d.olivares.imilenio@gmail.com`). Users can never elevate their own `role` or `active` flags.
3. **PII Isolation (Split Collection)**:
   - Staff emails reside strictly in `/staff/{uid}/private/contact`, readable only by the owner or Admin.
   - Customer full name, phone, and delivery address reside strictly in `/orders/{orderId}/private/customer`, readable ONLY by Admin, Cashier, or the originating Waiter (`waiterUid`). Kitchen staff cannot read customer PII.
4. **Role-Segmented State Machine**:
   - Only `mesero` or `admin` can create an order, and only with `status == 'pending'`, `paymentMethod == 'none'`, `waiterUid == request.auth.uid`, and server timestamps (`request.time`).
   - Only `cocina` or `admin` can advance `pending -> preparing -> ready`, touching strictly `['status', 'kitchenUid', 'updatedAt']`.
   - Only `cajero` or `admin` can collect payment on `ready` or `served` orders (`-> paid`), touching strictly `['status', 'paymentMethod', 'tip', 'total', 'amountReceived', 'changeGiven', 'cashierUid', 'paidAt', 'updatedAt']` with `amountReceived >= total` and `total == subtotal + tip`.
5. **Terminal State Locking & Anti-Fraud Deletion Lock**: Once an order reaches `paid` or `cancelled`, non-admins cannot modify or delete it. Only `admin` can delete orders or modify menu prices/availability.
6. **Immutable Audit Trail**: `/audit_logs/{logId}` is append-only (`allow update, delete: if false;`), readable only by `admin`.

## 2. The "Dirty Dozen" Attack Payloads (All MUST Return PERMISSION_DENIED)
1. **Self-Admin Escalation**: Unprivileged user creates `/staff/{uid}` with `{ "role": "admin", "active": true }`.
2. **Shadow Field Injection**: Waiter creates `/orders/{id}` with valid fields plus ghost field `{ "discountOverride": 999 }`.
3. **Unverified Admin Email Spoof**: Request with `token.email == 'd.olivares.imilenio@gmail.com'` but `token.email_verified == false`.
4. **Kitchen PII Scraping**: Active `cocina` user attempts `get` on `/orders/{orderId}/private/customer`.
5. **Kitchen Price Tampering**: Active `cocina` user updates `/orders/{orderId}` with `{ "status": "preparing", "total": 1 }`.
6. **Waiter Fraudulent Payment Marking**: Active `mesero` attempts to update `/orders/{orderId}` directly to `{ "status": "paid", "paymentMethod": "efectivo" }`.
7. **Cashier Post-Payment Tampering**: Active `cajero` attempts to modify a `paid` order's `total` or `status` back to `pending`.
8. **Underpayment Bypass**: Active `cajero` attempts to mark an order `paid` with `{ "total": 500, "amountReceived": 100 }`.
9. **Client Timestamp Forgery**: Waiter creates `/orders/{id}` with backdated `createdAt` instead of `request.time`.
10. **Path Variable Poisoning**: Caller attempts write to `/orders/../../admin_escape!@#$` or a >128-char ID.
11. **Array Exhaustion (Denial of Wallet)**: Waiter submits an order with `items.size() > 50` or `diners.size() > 12`.
12. **Audit Log Deletion / Tampering**: Any user (including Admin) attempts `update` or `delete` on `/audit_logs/{logId}`.
