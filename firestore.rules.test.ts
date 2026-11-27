import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
);

test('Global safety net default-deny catch-all exists at top of firestore.rules', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('All blueprint collections are explicitly matched in firestore.rules', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.length >= 8);
  assert.ok(rulesContent.includes('match /staff/{uid}'));
  assert.ok(rulesContent.includes('match /private/contact'));
  assert.ok(rulesContent.includes('match /menu_items/{itemId}'));
  assert.ok(rulesContent.includes('match /cash_register/{registerId}'));
  assert.ok(rulesContent.includes('match /orders/{orderId}'));
  assert.ok(rulesContent.includes('match /private/customer'));
  assert.ok(rulesContent.includes('match /daily_reports/{reportId}'));
  assert.ok(rulesContent.includes('match /audit_logs/{logId}'));
});

test('Dirty Dozen #1 & #3: Email verification required and self-admin escalation blocked', () => {
  assert.ok(rulesContent.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesContent.includes("incoming().role == 'pending' && incoming().active == false"));
  assert.ok(rulesContent.includes("affectedKeys().hasOnly(['displayName', 'updatedAt'])"));
});

test('Dirty Dozen #2 & #10 & #11: Shadow fields, ID poisoning, and array exhaustion blocked', () => {
  assert.ok(rulesContent.includes('data.keys().hasOnly('));
  assert.ok(rulesContent.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"));
  assert.ok(rulesContent.includes('diners.size() <= 12'));
  assert.ok(rulesContent.includes('items.size() <= 50'));
});

test('Dirty Dozen #4: Kitchen cannot access customer PII split collection', () => {
  const customerMatchIdx = rulesContent.indexOf('match /private/customer');
  assert.ok(customerMatchIdx > 0);
  const customerBlock = rulesContent.slice(customerMatchIdx, customerMatchIdx + 1000);
  assert.ok(customerBlock.includes('allow list: if false;'));
  assert.ok(!customerBlock.includes('isStrictKitchen()'));
  assert.ok(customerBlock.includes('isAdmin()'));
  assert.ok(customerBlock.includes('isStrictCashier()'));
});

test('Strict independent role separation across Waiter, Kitchen, Cashier, and Admin', () => {
  assert.ok(rulesContent.includes("function isStrictWaiter() {\n      return hasActiveRole('mesero');"));
  assert.ok(rulesContent.includes("function isStrictKitchen() {\n      return hasActiveRole('cocina');"));
  assert.ok(rulesContent.includes("function isStrictCashier() {\n      return hasActiveRole('cajero');"));
  assert.ok(rulesContent.includes("!(existing().status in ['paid', 'cancelled'])"));
  assert.ok(rulesContent.includes('isStrictCashier()\n              && isCashRegisterOpen()'));
  assert.ok(rulesContent.includes('incoming().amountReceived >= incoming().total'));
  assert.ok(rulesContent.includes('math.abs(data.total - (data.subtotal + data.tip)) <= 0.01'));
});

test('Dirty Dozen #9 & #12: Server timestamps enforced and audit logs are strictly immutable', () => {
  assert.ok(rulesContent.includes('incoming().createdAt == request.time'));
  assert.ok(rulesContent.includes('incoming().updatedAt == request.time'));
  assert.ok(rulesContent.includes('allow update, delete: if false;'));
});

test('Cash Register open/close and Daily Sales Reports are exclusively Admin-controlled', () => {
  const regIdx = rulesContent.indexOf('match /cash_register/{registerId}');
  assert.ok(regIdx > 0);
  const regBlock = rulesContent.slice(regIdx, regIdx + 1100);
  assert.ok(regBlock.includes("registerId == 'current'"));
  assert.ok(regBlock.includes('&& isAdmin()'));
  assert.ok(!regBlock.includes('isStrictCashier()'));

  const reportsIdx = rulesContent.indexOf('match /daily_reports/{reportId}');
  assert.ok(reportsIdx > 0);
  const reportsBlock = rulesContent.slice(reportsIdx, reportsIdx + 1200);
  assert.ok(reportsBlock.includes('allow get: if isValidId(reportId) && isAdmin();'));
  assert.ok(reportsBlock.includes('&& isAdmin()'));
  assert.ok(!reportsBlock.includes('isStrictCashier()'));
  assert.ok(
    rulesContent.includes(
      'math.abs(data.cashDifference - (data.countedCash - (data.openingCash + data.cashTotal))) <= 0.01'
    )
  );
});

test('Admin-only Menu Item creation & price/description editing validated in rules', () => {
  const menuIdx = rulesContent.indexOf('match /menu_items/{itemId}');
  assert.ok(menuIdx > 0);
  const menuBlock = rulesContent.slice(menuIdx, menuIdx + 950);
  assert.ok(menuBlock.includes('allow create:'));
  assert.ok(menuBlock.includes('&& isAdmin()'));
  assert.ok(menuBlock.includes("'desc'"));
  assert.ok(menuBlock.includes("'price'"));
});
