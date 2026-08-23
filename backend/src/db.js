"use strict";

const mongoose = require("mongoose");
require("./config/env");

let transactionsSupported = null;

async function connectDb(uri) {
  await mongoose.connect(uri);
  transactionsSupported = null;
}

function sessionOpts(session) {
  return session ? { session } : {};
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

function isUniqueViolation(err) {
  return isDuplicateKeyError(err);
}

function isTransactionUnsupportedError(err) {
  if (!err) return false;
  if (err.code === 20 || err.codeName === "IllegalOperation") return true;
  const msg = String(err.message || "");
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set member") ||
    msg.includes("transaction")
  );
}

async function canUseTransactions() {
  if (transactionsSupported != null) return transactionsSupported;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    // Replica set or mongos — transactions OK. Standalone local Mongo — not OK.
    transactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

function toId(value) {
  if (value == null) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function docToObject(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(docToObject);
  if (typeof doc.toJSON === "function") return doc.toJSON();
  if (typeof doc.toObject === "function") return doc.toObject();
  return doc;
}

async function withTransaction(fn) {
  if (!(await canUseTransactions())) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (isTransactionUnsupportedError(err)) {
      transactionsSupported = false;
      return fn(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  connectDb,
  mongoose,
  sessionOpts,
  isDuplicateKeyError,
  isUniqueViolation,
  toId,
  docToObject,
  withTransaction,
};
