import express from 'express';
import * as raffleCtrl from '../controllers/raffleController.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', raffleCtrl.getAllRaffles);
router.get('/:raffleId/ticket/:ticketNumber', raffleCtrl.getTicketByNumber);
router.post('/create', upload.single('prizeImage'), raffleCtrl.createRaffle);
router.post('/init-payment', raffleCtrl.initPayment);
router.post('/verify-payment', raffleCtrl.verifyPayment);
router.post('/webhook', raffleCtrl.verifyPayment);
router.get('/:id', raffleCtrl.getRaffle);
router.post('/end/:id/:secret', raffleCtrl.endRaffle);
router.delete('/:id/:secret', raffleCtrl.deleteRaffle);
router.patch('/:id/:secret', raffleCtrl.updateRaffleEndTime);
//router.get('/validate', raffleCtrl.validateTicket);

export default router;