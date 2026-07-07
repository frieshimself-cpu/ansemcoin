'use strict';

// These rules mirror the front-end validators exactly (extracted from the
// production bundle) so the client and server agree on what is acceptable.
//   username: 3–16 chars, letters/numbers/underscore
//   password: at least 6 chars
//   wallet:   Solana base58 address, 26–48 chars

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{26,48}$/;

function validateUsername(username) {
  if (typeof username !== 'string') return 'Username is required';
  if (username.length < 3) return 'Username needs at least 3 characters';
  if (username.length > 16) return 'Username can be at most 16 characters';
  if (!USERNAME_RE.test(username)) return 'Username can only use letters, numbers and _';
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 6) return 'Password needs at least 6 characters';
  return null;
}

function validateWallet(wallet) {
  if (typeof wallet !== 'string' || wallet.length === 0) return 'Wallet address is required';
  if (!WALLET_RE.test(wallet)) return "That doesn't look like a wallet address";
  return null;
}

module.exports = { validateUsername, validatePassword, validateWallet };
