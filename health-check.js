#!/usr/bin/env node

/**
 * EchoLink Simple Health Check
 * Checks if all services are configured and accessible
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('\n========================================');
console.log('   EchoLink System Health Check');
console.log('========================================\n');

let passed = 0;
let failed = 0;

// Helper function to check if file exists
function checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${description}: Found`);
        passed++;
        return true;
    } else {
        console.log(`❌ ${description}: NOT FOUND`);
        console.log(`   Expected: ${filePath}`);
        failed++;
        return false;
    }
}

// Helper function to check HTTP endpoint
function checkEndpoint(host, port, path, description) {
    return new Promise((resolve) => {
        const options = {
            host,
            port,
            path,
            method: 'GET',
            timeout: 3000,
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === 200) {
                console.log(`✅ ${description}: Running (${host}:${port})`);
                passed++;
                resolve(true);
            } else {
                console.log(`⚠️  ${description}: Responded with ${res.statusCode}`);
                passed++;
                resolve(false);
            }
        });

        req.on('error', () => {
            console.log(`❌ ${description}: Not responding (${host}:${port})`);
            console.log(`   Start it with: See README.md`);
            failed++;
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`❌ ${description}: Timeout`);
            failed++;
            resolve(false);
        });

        req.end();
    });
}

async function main() {
    console.log('Checking Project Structure...\n');

    // Check backend files
    checkFile('backend/package.json', 'Backend package.json');
    checkFile('backend/server.js', 'Backend server.js');
    checkFile('backend/.env', 'Backend .env');
    checkFile('backend/src/routes/admin.routes.js', 'Admin routes');

    // Check frontend files
    checkFile('frontend/package.json', 'Frontend package.json');
    checkFile('frontend/src/App.jsx', 'Frontend App.jsx');
    checkFile('frontend/.env', 'Frontend .env');
    checkFile('frontend/src/pages/AdminPage.jsx', 'Admin page');

    // Check embedding service
    checkFile('embed_service/app.py', 'Embedding service');
    checkFile('embed_service/requirements.txt', 'Python requirements');

    // Check sample data
    checkFile('sample_whatsapp.txt', 'Sample WhatsApp data');

    console.log('\n\nChecking Running Services...\n');

    // Check if services are running
    await checkEndpoint('localhost', 5000, '/health', 'Embedding Service');
    await checkEndpoint('localhost', 3001, '/health', 'Backend API');
    await checkEndpoint('localhost', 3000, '/', 'Frontend');

    // Summary
    console.log('\n========================================');
    console.log('   Health Check Summary');
    console.log('========================================\n');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    const total = passed + failed;
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;
    console.log(`📊 Health: ${percentage}%`);

    console.log('\n');
    if (failed === 0) {
        console.log('🎉 All checks passed! System is healthy.');
    } else if (failed <= 3) {
        console.log('⚠️  Some services are not running. Start them with:');
        console.log('   Windows: .\\start-all.ps1');
        console.log('   Manual:  See README.md for manual start instructions');
    } else {
        console.log('❌ Multiple issues detected. Please check:');
        console.log('   1. All dependencies installed (npm install in backend/ and frontend/)');
        console.log('   2. Python dependencies installed (pip install -r requirements.txt)');
        console.log('   3. .env files configured correctly');
        console.log('   4. MongoDB is running and accessible');
    }

    console.log('\n📖 For more info, see: README.md');
    console.log('🚀 To start all services: .\\start-all.ps1\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('\n❌ Health check failed:', error.message);
    process.exit(1);
});
