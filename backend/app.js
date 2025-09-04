import express from 'express';
import cors from 'cors';
import raffleRoutes from './routes/raffleRoutes.js';

const app = express();
// Test route
app.get('/', (req, res) => res.send('🎉 RaffleHub Backend Running!'));

export default app;