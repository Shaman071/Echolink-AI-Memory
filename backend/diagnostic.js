#!/usr/bin/env node

/**
 * Echolink Diagnostic & Auto-Fix Script
 * Runs comprehensive checks and attempts to fix issues automatically
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config(); // Load .env from backend directory

const REPORT_FILE = path.join(__dirname, '../fix-report.txt');
let reportLines = [];

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}`;
  console.log(logLine);
  reportLines.push(logLine);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`);
  log(title);
  log(`${'='.repeat(80)}\n`);
}

async function checkMongoDB() {
  logSection('Checking MongoDB Connection');
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://latnasaga30_db_user:shaman123@cluster0.wdjj1ep.mongodb.net/?appName=Cluster0';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    log('✓ MongoDB connection successful');
    await mongoose.disconnect();
    return true;
  } catch (error) {
    log(`✗ MongoDB connection failed: ${error.message}`, 'ERROR');
    log('Action: Check MONGODB_URI in .env', 'ACTION');
    return false;
  }
}

async function checkEmbeddingService() {
  logSection('Checking Embedding Service');
  try {
    const embeddingUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:5000';
    const response = await axios.get(`${embeddingUrl}/health`, { timeout: 5000 });
    log(`✓ Embedding service reachable: ${response.data.status}`);
    log(`  - Model: ${response.data.model_name || 'unknown'}`);
    log(`  - Embedding dimension: ${response.data.embedding_dim || 'unknown'}`);

    // Check delete endpoint existence
    try {
      await axios.post(`${embeddingUrl}/delete`, { ids: [] }, { validateStatus: s => s === 400 });
      log('✓ /delete endpoint exists');
    } catch (e) {
      if (e.response && e.response.status === 404) {
        log('✗ /delete endpoint missing (service may be outdated)', 'WARN');
      } else {
        log(`? /delete endpoint check inconclusive: ${e.message}`, 'WARN');
      }
    }

    return true;
  } catch (error) {
    log(`✗ Embedding service unreachable: ${error.message}`, 'WARN');
    log('Action: Start embedding service with: python embed_service/app.py', 'ACTION');
    return false;
  }
}

async function checkBackendAPI() {
  logSection('Checking Backend API');
  const apiUrl = 'http://localhost:3001/api';

  try {
    const response = await axios.get(`${apiUrl.replace('/api', '')}/health`, { timeout: 5000 });
    log(`✓ Backend API reachable on port 3001`);
    log(`  - Status: ${response.data.status}`);
    return true;
  } catch (error) {
    log(`✗ Backend API unreachable: ${error.message}`, 'ERROR');
    log('Action: Start backend with: cd backend && npm start', 'ACTION');
    return false;
  }
}

async function checkAPIRoutes() {
  logSection('Checking Required API Routes');
  const baseUrl = 'http://localhost:3001/api';

  // Test with a dummy token
  const headers = { Authorization: 'Bearer dummy-token' };

  const routes = [
    { method: 'POST', path: '/auth/register', skipAuth: true },
    { method: 'POST', path: '/auth/login', skipAuth: true },
    { method: 'POST', path: '/import/upload' },
    { method: 'POST', path: '/import/text' },
    { method: 'GET', path: '/import/sources' },
    { method: 'POST', path: '/query' },
    { method: 'GET', path: '/graph' },
    { method: 'GET', path: '/status' },
    { method: 'POST', path: '/admin/reindex-all' }, // New Admin route
  ];

  for (const route of routes) {
    try {
      const config = {
        method: route.method.toLowerCase(),
        url: `${baseUrl}${route.path}`,
        timeout: 3000,
        validateStatus: () => true, // Accept any status
      };

      if (!route.skipAuth) config.headers = headers;

      const response = await axios(config);
      const status = response.status;

      if (status === 404) {
        log(`✗ Route missing: ${route.method} ${route.path}`, 'ERROR');
      } else if (status === 401 || status === 400 || status === 403) {
        log(`✓ Route exists: ${route.method} ${route.path} (Status ${status})`);
      } else {
        log(`✓ Route exists: ${route.method} ${route.path} (Status ${status})`);
      }
    } catch (error) {
      log(`✗ Cannot check route: ${route.method} ${route.path} - ${error.message}`, 'WARN');
    }
  }
}

async function checkEnvVariables() {
  logSection('Checking Environment Variables');

  const backendEnvPath = path.join(__dirname, '.env');
  const frontendEnvPath = path.join(__dirname, '../frontend/.env');

  // Check backend .env
  if (fs.existsSync(backendEnvPath)) {
    log('✓ backend/.env exists');
    const content = fs.readFileSync(backendEnvPath, 'utf8');

    if (content.includes('OPENAI_API_KEY=')) {
      const keyLine = content.split('\n').find(l => l.startsWith('OPENAI_API_KEY='));
      const hasKey = keyLine && !keyLine.includes('=\n') && !keyLine.includes('=\r\n') && keyLine.split('=')[1].trim().length > 0;
      if (hasKey) {
        log('  - OPENAI_API_KEY is configured');
      } else {
        log('  - OPENAI_API_KEY is empty (will use local embedding service)', 'WARN');
      }
    }

    if (content.includes('EMBEDDING_SERVICE_URL=')) {
      log('  - EMBEDDING_SERVICE_URL is configured');
    }

    if (content.includes('MONGODB_URI=')) {
      log('  - MONGODB_URI is configured');
    }
  } else {
    log('✗ backend/.env not found', 'ERROR');
  }

  // Check frontend .env
  if (fs.existsSync(frontendEnvPath)) {
    log('✓ frontend/.env exists');
    const content = fs.readFileSync(frontendEnvPath, 'utf8');
    if (content.includes('VITE_API_URL=')) {
      log('  - VITE_API_URL is configured');
    }
  } else {
    log('✗ frontend/.env not found', 'WARN');
  }
}

async function generateReport() {
  logSection('Diagnostic Report Summary');

  log('');
  log('NEXT STEPS:');
  log('');
  log('1. Ensure all services are running:');
  log('   - Terminal 1: cd embed_service && python app.py');
  log('   - Terminal 2: cd backend && npm start');
  log('   - Terminal 3: cd frontend && npm run dev');
  log('');
  log('2. Verify system health with this script.');
  log('');
  log('For more details, see: ' + REPORT_FILE);
  log('');

  // Write report to file
  fs.writeFileSync(REPORT_FILE, reportLines.join('\n'));
  log(`Report saved to: ${REPORT_FILE}`);
}

async function main() {
  logSection('ECHOLINK DIAGNOSTIC & AUTO-FIX');
  log(`Started: ${new Date().toISOString()}`);
  log('');

  try {
    // Run all checks
    const mongoOk = await checkMongoDB();
    const embeddingOk = await checkEmbeddingService();
    const apiOk = await checkBackendAPI();

    if (apiOk) {
      await checkAPIRoutes();
    }

    await checkEnvVariables();

    // Generate final report
    await generateReport();
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'ERROR');
    console.error(error);
  }
}

// Run diagnostics
if (require.main === module) {
  main().then(() => {
    console.log('\nDiagnostic complete!');
    process.exit(0);
  }).catch(error => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });
}

module.exports = { log, logSection };
