'use strict';

// Self-contained auth primitives using only Node's built-in crypto — no native
// modules to build, so this installs and runs anywhere Node does.
//
//   - Passwords: scrypt with a per-user random salt.
//   - Tokens:    compact HS256 JWTs the client stores and sends as
//                `Authorization: Bearer <token>`, matching the front-end.

const crypto = require('crypto');

const SECRET =
  process.env.JWT_SECRET ||
  'dev-insecure-secret-change-me-in-production';

if (!process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is not set — using an insecure development secret. ' +
      'Set JWT_SECRET in the environment before deploying.'
  );
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlToBuf(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

// --- passwords -------------------------------------------------------------

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false; // seed users have no password
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// --- tokens (HS256 JWT) ----------------------------------------------------

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: nowSeconds() }));
  const data = `${header}.${body}`;
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(data).digest());
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
  } catch {
    return null;
  }
}

// `iat` is stamped in seconds; sourced through a helper so tests can see intent.
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
