import express from 'express';
import cors from 'cors';
import raffleRoutes from './routes/raffleRoutes.js';

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/raffles', raffleRoutes);

// Test route
app.get('/', (req, res) => res.send('🎉 RaffleHub Backend Running!'));

export default app;