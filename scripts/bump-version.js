#!/usr/bin/env node

/**
 * FlowPOS Pro - Unified Version Bump Script
 * =========================================
 * Single source of truth: version.json
 * Synchronizes: version.json, public/version.json, package.json, package-lock.json, build.gradle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'version.json');
const PUBLIC_VERSION_FILE = path.join(ROOT_DIR, 'public', 'version.json');
const PKG_FILE = path.join(ROOT_DIR, 'package.json');
const LOCK_FILE = path.join(ROOT_DIR, 'package-lock.json');
const BUILD_GRADLE_FILE = path.join(ROOT_DIR, 'android', 'app', 'build.gradle');

const args = process.argv.slice(2);
let incrementBy = 1;
let setVersion = null;
let bumpType = 'build'; // 'build' | 'minor' | 'patch' | 'major'
let customVersionName = null;
let customDescription = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--increment' && args[i + 1]) {
    incrementBy = Number.parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--set' && args[i + 1]) {
    setVersion = Number.parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--minor') {
    bumpType = 'minor';
  } else if (arg === '--patch') {
    bumpType = 'patch';
  } else if (arg === '--major') {
    bumpType = 'major';
  } else if (arg === '--name' && args[i + 1]) {
    customVersionName = args[i + 1].trim();
    i++;
  } else if (arg === '--desc' && args[i + 1]) {
    customDescription = args[i + 1].trim();
    i++;
  }
}

function bumpSemver(versionStr, type) {
  const parts = versionStr.split('.').map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isNaN(n) ? 0 : n;
  });
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2] += 1;
  }
  return parts.slice(0, 3).join('.');
}

function main() {
  console.log('\n🚀 FlowPOS Pro - Unified Version Bump Tool\n');

  if (!fs.existsSync(VERSION_FILE)) {
    console.error('❌ Error: version.json not found at', VERSION_FILE);
    process.exit(1);
  }

  const raw = fs.readFileSync(VERSION_FILE, 'utf8');
  const versionData = JSON.parse(raw);

  const oldVersionCode = Number(versionData.versionCode) || 382;
  const oldVersionName = versionData.versionName || '1.5.3';

  let newVersionCode = setVersion !== null ? setVersion : oldVersionCode + incrementBy;
  if (!Number.isSafeInteger(newVersionCode) || newVersionCode <= 0) {
    console.error('❌ Error: Invalid new versionCode:', newVersionCode);
    process.exit(1);
  }

  let newVersionName = oldVersionName;
  if (customVersionName) {
    newVersionName = customVersionName;
  } else if (bumpType === 'minor' || bumpType === 'patch' || bumpType === 'major') {
    newVersionName = bumpSemver(oldVersionName, bumpType);
  }

  versionData.versionCode = newVersionCode;
  versionData.versionName = newVersionName;
  versionData.lastUpdated = new Date().toISOString();

  if (!Array.isArray(versionData.buildHistory)) {
    versionData.buildHistory = [];
  }

  const desc = customDescription || `Release v${newVersionName} (Build ${newVersionCode})`;
  versionData.buildHistory.unshift({
    versionCode: newVersionCode,
    versionName: newVersionName,
    date: versionData.lastUpdated.split('T')[0],
    description: desc,
  });

  if (versionData.buildHistory.length > 20) {
    versionData.buildHistory = versionData.buildHistory.slice(0, 20);
  }

  const formattedJson = JSON.stringify(versionData, null, 2) + '\n';
  fs.writeFileSync(VERSION_FILE, formattedJson, 'utf8');
  console.log('✅ Updated version.json');

  const publicDir = path.dirname(PUBLIC_VERSION_FILE);
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(PUBLIC_VERSION_FILE, formattedJson, 'utf8');
    console.log('✅ Updated public/version.json');
  }

  if (fs.existsSync(PKG_FILE)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(PKG_FILE, 'utf8'));
      pkg.version = newVersionName;
      fs.writeFileSync(PKG_FILE, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log('✅ Updated package.json (version: ' + newVersionName + ')');
    } catch (e) {
      console.warn('⚠️ Could not update package.json version:', e.message);
    }
  }

  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      lock.version = newVersionName;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = newVersionName;
      }
      fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n', 'utf8');
      console.log('✅ Updated package-lock.json');
    } catch (e) {
      console.warn('⚠️ Could not update package-lock.json version:', e.message);
    }
  }

  if (fs.existsSync(BUILD_GRADLE_FILE)) {
    let gradle = fs.readFileSync(BUILD_GRADLE_FILE, 'utf8');
    if (gradle.includes('versionProps.versionCode')) {
      console.log('✅ android/app/build.gradle dynamically reads version.json');
    }
  }

  console.log('\n✨ Version Bump Complete!');
  console.log(`   Version Code: ${oldVersionCode} ➔ ${newVersionCode}`);
  console.log(`   Version Name: ${oldVersionName} ➔ ${newVersionName}`);
  console.log(`   Timestamp:    ${versionData.lastUpdated}\n`);
}

main();
