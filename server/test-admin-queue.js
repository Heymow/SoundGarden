/* Minimal test script to enqueue an admin action and retrieve it (simulate cog)
   Usage: node test-admin-queue.js
*/

import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:3001';
const TOKEN = process.env.CW_TOKEN || '';

async function main() {
  try {
    const action = {
      action: 'start_new_week',
      params: { theme: 'Test Theme' }
    };

    console.log('Queueing action...');
    const res = await axios.post(`${BASE}/api/admin/actions`, action, { headers: { 'Content-Type': 'application/json' } });
    console.log('Queued:', res.data);

    console.log('Simulating cog poll...');
    const next = await axios.get(`${BASE}/api/collabwarz/next-action`, { headers: { 'X-CW-Token': TOKEN } });
    console.log('Next action:', next.data);

    // Simulate processing and report result
    const { action: actionData } = next.data;
    const result = { id: actionData.id, status: 'completed', details: { processed_by: 'test' } };

    const postResult = await axios.post(`${BASE}/api/collabwarz/action-result`, result, { headers: { 'X-CW-Token': TOKEN } });
    console.log('Result posted:', postResult.data);

  } catch (error) {
    console.error('Error during test:', error.response?.data || error.message);
  }
}

main();
