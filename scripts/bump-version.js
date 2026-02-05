#!/usr/bin/env node

/**
 * Version Bump Script
 * ====================
 * Automatically increments the version code for Android builds
 * 
 * Usage:
 *   node scripts/bump-version.js              # Increment by 1
 *   node scripts/bump-version.js --increment 5  # Increment by 5
 *   node scripts/bump-version.js --set 250     # Set to specific value
 */

const fs = require('fs');
const path = require('path');

// File paths
const VERSION_FILE = path.join(__dirname, '..', 'version.json');
const BUILD_GRADLE_FILE = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

// Parse command line arguments
const args = process.argv.slice(2);
let incrementBy = 1;
let setVersion = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--increment' && args[i + 1]) {
        incrementBy = parseInt(args[i + 1], 10);
        i++;
    } else if (args[i] === '--set' && args[i + 1]) {
        setVersion = parseInt(args[i + 1], 10);
        i++;
    }
}

// Read version.json
function readVersionFile() {
    try {
        const content = fs.readFileSync(VERSION_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ Error reading version.json:', error.message);
        process.exit(1);
    }
}

// Write version.json
function writeVersionFile(versionData) {
    try {
        fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
        console.log('✅ Updated version.json');
    } catch (error) {
        console.error('❌ Error writing version.json:', error.message);
        process.exit(1);
    }
}

// Update build.gradle
function updateBuildGradle(versionCode, versionName) {
    try {
        let content = fs.readFileSync(BUILD_GRADLE_FILE, 'utf8');

        // Update versionCode
        content = content.replace(
            /versionCode\s+\d+/,
            `versionCode ${versionCode}`
        );

        // Update versionName
        content = content.replace(
            /versionName\s+"[^"]+"/,
            `versionName "${versionName}"`
        );

        fs.writeFileSync(BUILD_GRADLE_FILE, content, 'utf8');
        console.log('✅ Updated build.gradle');
    } catch (error) {
        console.error('❌ Error updating build.gradle:', error.message);
        process.exit(1);
    }
}

// Main function
function main() {
    console.log('\n🚀 Version Bump Script\n');

    // Read current version
    const versionData = readVersionFile();
    const oldVersionCode = versionData.versionCode;

    // Calculate new version code
    let newVersionCode;
    if (setVersion !== null) {
        newVersionCode = setVersion;
        console.log(`📝 Setting version code to: ${newVersionCode}`);
    } else {
        newVersionCode = oldVersionCode + incrementBy;
        console.log(`📈 Incrementing version code by ${incrementBy}`);
    }

    // Validate
    if (newVersionCode <= oldVersionCode && setVersion === null) {
        console.error('❌ Error: New version code must be greater than current version');
        process.exit(1);
    }

    // Update version data
    versionData.versionCode = newVersionCode;
    versionData.lastUpdated = new Date().toISOString();

    // Add to build history
    if (!versionData.buildHistory) {
        versionData.buildHistory = [];
    }
    versionData.buildHistory.push({
        versionCode: newVersionCode,
        date: versionData.lastUpdated,
        description: `Bumped from ${oldVersionCode} to ${newVersionCode}`
    });

    // Keep only last 10 history entries
    if (versionData.buildHistory.length > 10) {
        versionData.buildHistory = versionData.buildHistory.slice(-10);
    }

    // Write changes
    writeVersionFile(versionData);
    updateBuildGradle(newVersionCode, versionData.versionName);

    console.log('\n✨ Version bump complete!');
    console.log(`   Old version code: ${oldVersionCode}`);
    console.log(`   New version code: ${newVersionCode}`);
    console.log(`   Version name: ${versionData.versionName}\n`);
}

// Run
main();
