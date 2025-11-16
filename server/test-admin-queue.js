/* Minimal test script to enqueue an admin action and retrieve it (simulate cog)
   Usage: node test-admin-queue.js
*/

import axios from "axios";

const BASE = process.env.BASE || "http://localhost:3001";
const TOKEN = process.env.CW_TOKEN || "";

async function main() {
  try {
    const action = {
      action: "start_new_week",
      params: { theme: "Test Theme" },
    };

    console.log("Queueing action...");
    const res = await axios.post(`${BASE}/api/admin/actions`, action, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Queued:", res.data);

    console.log("Simulating cog poll...");
    const next = await axios.get(`${BASE}/api/collabwarz/next-action`, {
      headers: { "X-CW-Token": TOKEN },
    });
    console.log("Next action:", next.data);

    // Simulate processing and report result
    const { action: actionData } = next.data;
    const actions = [
      { action: 'set_theme', params: { theme: 'Test Theme' } },
      { action: 'set_phase', params: { phase: 'voting' } },
      { action: 'start_new_week', params: { theme: 'Local Test' } },
      { action: 'cancel_week', params: { reason: 'Integration test' } },
      { action: 'clear_submissions', params: {} },
      { action: 'next_phase', params: {} },
      { action: 'toggle_automation', params: {} },
      { action: 'reset_week', params: {} },
      { action: 'force_voting', params: {} },
      { action: 'announce_winners', params: {} },
    ];

    for (const a of actions) {
      console.log('Queueing action...', a.action);
      const res = await axios.post(`${BASE}/api/admin/actions`, a, { headers: { 'Content-Type': 'application/json' } });
      console.log('Queued:', res.data);

      // Simulate cog polling and processing
      console.log('Simulating cog poll...');
      const next = await axios.get(`${BASE}/api/collabwarz/next-action`, { headers: { 'X-CW-Token': TOKEN } });
      if (next.status === 204) {
        console.log('No action available (maybe Redis is used)');
        continue;
      }
      console.log('Next action:', next.data);

      const actionData = next.data.action;
      const result = { id: actionData.id, status: 'completed', details: { processed_by: 'test' } };
      const postResult = await axios.post(`${BASE}/api/collabwarz/action-result`, result, { headers: { 'X-CW-Token': TOKEN } });
      console.log('Result posted:', postResult.data);
    }
