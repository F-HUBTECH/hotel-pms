/**
 * Script to execute SQL deployment file via Supabase Management API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://rbpiwglmpahwvabzcgzr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicGl3Z2xtcGFod3ZhYnpjZ3pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI4NTAzMSwiZXhwIjoyMDg3ODYxMDMxfQ.pkVhXjkdYeqagKckEnyihA4ogLl_3eakLzBGhh0wxxE';

// Read the SQL file
const sqlFile = path.join(__dirname, '../supabase/deploy-forecast-complete.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('Executing forecast deployment SQL...');
console.log(`SQL file length: ${sqlContent.length} characters`);

// Use the Supabase REST API to execute SQL
const options = {
  hostname: SUPABASE_URL.replace('https://', ''),
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✓ SQL executed successfully');
    } else {
      console.log('✗ SQL execution failed');
    }
  });
});

req.on('error', (error) => {
  console.error('Error executing SQL:', error);
  console.log('Please run the SQL manually in Supabase SQL Editor');
});

req.write(JSON.stringify({ sql: sqlContent }));
req.end();
