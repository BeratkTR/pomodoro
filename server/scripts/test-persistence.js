#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3001'; // Adjust port if needed
const ADMIN_HEADERS = { 'x-admin': 'true' };

async function testPersistence() {
  try {
    console.log('🔍 Testing Persistence System...\n');
    
    // Test 1: Check persistence status
    console.log('1. Checking persistence status...');
    const statusResponse = await axios.get(`${BASE_URL}/api/admin/persistence/status`, {
      headers: ADMIN_HEADERS
    });
    console.log('✅ Status:', statusResponse.data);
    console.log('');
    
    // Test 2: Get current data
    console.log('2. Getting current data...');
    const dataResponse = await axios.get(`${BASE_URL}/api/admin/data`, {
      headers: ADMIN_HEADERS
    });
    console.log('✅ Current data:', {
      rooms: dataResponse.data.rooms.length,
      users: dataResponse.data.users.length
    });
    console.log('');
    
    // Test 3: Manual save
    console.log('3. Triggering manual save...');
    const saveResponse = await axios.post(`${BASE_URL}/api/admin/persistence/save`, {}, {
      headers: ADMIN_HEADERS
    });
    console.log('✅ Save result:', saveResponse.data);
    console.log('');
    
    // Test 4: Check if data files exist
    console.log('4. Checking if persistence files exist...');
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '..', 'data');
    const roomsFile = path.join(dataDir, 'rooms.json');
    const usersFile = path.join(dataDir, 'users.json');
    
    const roomsExist = fs.existsSync(roomsFile);
    const usersExist = fs.existsSync(usersFile);
    
    console.log('✅ Files exist:', { rooms: roomsExist, users: usersExist });
    
    if (roomsExist) {
      const roomsData = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
      console.log('   - Rooms file size:', Object.keys(roomsData).length, 'rooms');
    }
    
    if (usersExist) {
      const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      console.log('   - Users file size:', Object.keys(usersData).length, 'users');
    }
    
    // Test 5: Check timer recovery information
    console.log('5. Checking timer recovery information...');
    try {
      const recoveryResponse = await axios.get(`${BASE_URL}/api/admin/persistence/recovery`, {
        headers: ADMIN_HEADERS
      });
      console.log('✅ Recovery info:', recoveryResponse.data);
    } catch (error) {
      console.log('ℹ️  Recovery endpoint not available or no recovery data:', error.response?.status);
    }
    
    console.log('\n🎉 Enhanced persistence system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testPersistence(); 