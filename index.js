const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const userRoutes = require('./routes/users');
const bamRoutes = require('./routes/bams');
const callRoutes = require('./routes/calls');     // 👈 nouveau
const reviewRoutes = require('./routes/reviews'); // 👈 nouveau

app.use('/users', userRoutes);
app.use('/bams', bamRoutes);
app.use('/calls', callRoutes);       // 👈 nouveau
app.use('/reviews', reviewRoutes);   // 👈 nouveau

app.get('/', (req, res) => res.send('🧭 BAM API is running'));

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
