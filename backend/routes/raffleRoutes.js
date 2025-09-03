import express from 'express';
import * as raffleCtrl from '../controllers/raffleController.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/create', upload.single('prizeImage'), raffleCtrl.createRaffle);
router.post('/init-payment', raffleCtrl.initPayment);
router.post('/verify-payment', raffleCtrl.verifyPayment); // New route for frontend verification
router.post('/webhook', raffleCtrl.verifyPayment); // Keep for Paystack webhook
router.get('/:id', raffleCtrl.getRaffle);
router.post('/end/:id/:secret', raffleCtrl.endRaffle);
router.get('/validate', raffleCtrl.validateTicket);

export default router;