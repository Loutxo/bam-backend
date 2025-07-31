const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Import des routes
const userRoutes = require('./routes/users');
const bamRoutes = require('./routes/bams');

// Routing
app.use('/users', userRoutes);
app.use('/bams', bamRoutes);

app.get('/', (req, res) => {
  res.send('🧭 BAM API is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
