/**
 * SmartStock Enterprise - Vercel Serverless API Proxy
 *
 * This file runs on Vercel and proxies ALL /api/* requests
 * to the Java backend running on Render.com.
 *
 * Architecture:
 *   Browser → Vercel (this file) → Render.com Java Backend → Supabase
 *
 * URL: https://smart-stock-enterprise-rasikashrees-projects.vercel.app/api/*
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

// ── Config ────────────────────────────────────────────────────────────────────
const RENDER_BACKEND = process.env.RENDER_BACKEND_URL ||
  'https://smartstock-enterprise-backend.onrender.com';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Root health check ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'SmartStock Enterprise',
    version: '2.0.0',
    platform: 'Vercel (Node.js proxy)',
    backend: RENDER_BACKEND,
    status: 'online'
  });
});

// ── Proxy: forward ALL /api/* to Render Java backend ─────────────────────────
app.all('/api/*', async (req, res) => {
  const targetUrl = `${RENDER_BACKEND}${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  console.log(`[Proxy] ${req.method} ${req.path} → ${targetUrl}`);

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Forwarded-For': req.ip || 'vercel-proxy',
        'X-Forwarded-Host': req.hostname,
        'X-Proxy': 'vercel'
      }
    };

    // Forward request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text(); // Use text to handle both JSON and non-JSON

    // Forward status + headers
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('X-Proxied-By', 'vercel-smartstock');
    res.setHeader('X-Backend', RENDER_BACKEND);

    res.send(data);
  } catch (error) {
    console.error(`[Proxy Error] ${error.message}`);

    // If Render is sleeping (cold start), return a friendly error
    if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
      return res.status(503).json({
        error: 'Backend is waking up (cold start). Please retry in 15 seconds.',
        backend: RENDER_BACKEND,
        status: 'cold-start'
      });
    }

    res.status(502).json({
      error: 'Proxy error: ' + error.message,
      backend: RENDER_BACKEND,
      path: req.path
    });
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ── Start (local dev only; Vercel uses module.exports) ───────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`SmartStock Proxy running at http://localhost:${PORT}`);
    console.log(`Forwarding /api/* → ${RENDER_BACKEND}`);
  });
}

module.exports = app;
