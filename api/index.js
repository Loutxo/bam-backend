// Vercel Serverless Function Handler
// Import l'app Express depuis bam-auth-server.js
const app = require('../bam-auth-server.js');

// Export la fonction handler pour Vercel
module.exports = app;
