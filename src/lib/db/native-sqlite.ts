// src/lib/db/native-sqlite.ts
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { initNativeSchema } from './schema';

const DB_NAME = 'flowpos_local_db';
let sqliteConnection: SQLiteConnection | null = null;
let dbInstance: SQLiteDBConnection | null = null;
let isInitialized = false;

export const isNativeStorageSupported = (): boolean => {
  return Capacitor.isNativePlatform();
};

export async function getNativeDB(): Promise<SQLiteDBConnection | null> {
  if (!isNativeStorageSupported()) {
    return null; // العمل على الويب يستخدم IndexedDB
  }

  if (dbInstance && isInitialized) {
    return dbInstance;
  }

  try {
    if (!sqliteConnection) {
      sqliteConnection = new SQLiteConnection(CapacitorSQLite);
    }

    const isConn = (await sqliteConnection.isConnection(DB_NAME, false)).result;
    if (isConn) {
      dbInstance = await sqliteConnection.retrieveConnection(DB_NAME, false);
    } else {
      dbInstance = await sqliteConnection.createConnection(
        DB_NAME,
        false, // encrypted: false (أو true إذا رغبت بتشفير SQLCipher)
        'no-encryption',
        1,
        false
      );
    }

    await dbInstance.open();
    await initNativeSchema(dbInstance);
    isInitialized = true;
    return dbInstance;
  } catch (error) {
    console.error('❌ [NativeSQLite] فشل تهيئة قاعدة بيانات SQLite:', error);
    return null;
  }
}
