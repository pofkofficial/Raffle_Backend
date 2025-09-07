import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import Raffle from '../models/Raffle.js';
import Admin from '../models/Admin.js';
import bcrypt from 'bcrypt';
import generateQR from '../utils/generateQR.js';
import generatePDF from '../utils/generatePDF.js';

// Admin login
export const adminLogin = async (req, res) => {
  console.log('POST /api/admin/login:', req.body);
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }
    const admin = await Admin.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    const token = jwt.sign({ username: admin.username, role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.status(200).json({ token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Failed to login', details: err.message });
  }
};

// Create raffle
export const createRaffle = [
  (req, res, next) => {
    console.log('Before createRaffle:', req.headers, req.body);
    next();
  },
  async (req, res) => {
    console.log('After multer: headers=', req.headers, 'body=', req.body, 'file=', req.file);
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const token = authHeader.split(' ')[1];
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { title, description, prizeTypes, cashPrize, itemName, ticketPrice, endTime } = req.body;

      // Parse prizeTypes
      let parsedPrizeTypes;
      try {
        parsedPrizeTypes = JSON.parse(prizeTypes);
        if (!Array.isArray(parsedPrizeTypes) || parsedPrizeTypes.length === 0) {
          throw new Error('Invalid prize types');
        }
        if (!parsedPrizeTypes.every(type => ['cash', 'item'].includes(type))) {
          throw new Error('Prize types must be "cash" or "item"');
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid prize types format', details: err.message });
      }

      // Validate required fields
      if (!title) {
        return res.status(400).json({ error: 'Missing required field: title' });
      }
      if (parsedPrizeTypes.includes('cash') && (!cashPrize || isNaN(cashPrize) || parseFloat(cashPrize) <= 0)) {
        return res.status(400).json({ error: 'Cash prize must be a positive number' });
      }
      if (parsedPrizeTypes.includes('item') && !itemName) {
        return res.status(400).json({ error: 'Item name is required when item is selected' });
      }
      if (!ticketPrice || isNaN(ticketPrice) || parseFloat(ticketPrice) < 0) {
        return res.status(400).json({ error: 'Ticket price must be a non-negative number' });
      }
      const endDate = new Date(endTime);
      if (isNaN(endDate.getTime()) || endDate <= new Date()) {
        return res.status(400).json({ error: 'End time must be a valid date in the future' });
      }

      // Create raffle
      const raffle = new Raffle({
        title,
        description: description || '',
        prizeTypes: parsedPrizeTypes,
        cashPrize: parsedPrizeTypes.includes('cash') ? parseFloat(cashPrize) : null,
        itemName: parsedPrizeTypes.includes('item') ? itemName : null,
        prizeImage: req.file ? req.file.buffer.toString('base64') : null,
        ticketPrice: parseFloat(ticketPrice),
        endTime: endDate,
        createdBy: decoded.username,
        creatorSecret: crypto.randomBytes(16).toString('hex'),
        createdAt: new Date(),
      });

      await raffle.save();
      res.status(201).json({
        id: raffle._id,
        creatorSecret: raffle.creatorSecret,
      });
    } catch (err) {
      console.error('Create raffle error:', err);
      res.status(400).json({ error: 'Failed to create raffle', details: err.message });
    }
  },
];

// Initialize payment
export const initPayment = async (req, res) => {
  const { raffleId, displayName, contact, email } = req.body;
  console.log('POST /api/raffles/init-payment:', { raffleId, displayName, contact, email });
  try {
    if (!raffleId || !displayName || !contact) {
      return res.status(400).json({ error: 'Missing required fields: raffleId, displayName, contact' });
    }
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    if (raffle.ticketPrice === 0) {
      return handleTicketGeneration(req, res, raffle, displayName, contact);
    }
    res.status(200).json({
      ticketPrice: raffle.ticketPrice,
      currency: 'GHS',
      raffleId,
      displayName,
      contact,
      email,
    });
  } catch (err) {
    console.error('Init payment error:', err);
    res.status(500).json({ error: 'Failed to initialize payment', details: err.message });
  }
};

// Verify payment
export const verifyPayment = async (req, res) => {
  const { reference, raffleId, name: displayName, contact, email } = req.body;
  console.log('POST /api/raffles/verify-payment or /webhook:', { reference, raffleId, displayName, contact, email });
  try {
    if (req.headers['x-paystack-signature']) {
      console.log('Processing Paystack webhook');
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (hash !== req.headers['x-paystack-signature']) {
        console.error('Invalid Paystack signature:', hash, req.headers['x-paystack-signature']);
        return res.status(400).json({ error: 'Invalid Paystack signature' });
      }
      const event = req.body;
      if (event.event === 'charge.success') {
        const { raffleId, displayName, contact } = event.data.metadata;
        console.log('Webhook charge.success:', { raffleId, displayName, contact });
        const raffle = await Raffle.findById(raffleId);
        if (!raffle) {
          console.error('Raffle not found for webhook:', raffleId);
          return res.status(404).json({ error: 'Raffle not found' });
        }
        await handleTicketGeneration({ body: { raffleId, displayName, contact } }, res, raffle, displayName, contact);
        return res.status(200).send();
      }
      return res.status(200).send();
    }
    console.log('Processing client-side payment verification');
    if (!reference || !raffleId || !displayName || !contact) {
      console.error('Missing required fields:', { reference, raffleId, displayName, contact, email });
      return res.status(400).json({ error: 'Missing required fields: reference, raffleId, displayName, contact' });
    }
    if (!process.env.PAYSTACK_SECRET) {
      console.error('PAYSTACK_SECRET is not defined');
      throw new Error('PAYSTACK_SECRET is not defined');
    }
    console.log('Verifying payment with Paystack API:', reference);
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
    }).catch(err => {
      console.error('Paystack API error:', err.response?.data || err.message);
      throw new Error(`Paystack API error: ${err.response?.data?.message || err.message}`);
    });
    console.log('Paystack API response:', JSON.stringify(response.data, null, 2));
    if (response.data.status !== true || response.data.data.status !== 'success') {
      console.error('Payment verification failed:', response.data);
      return res.status(400).json({ error: 'Payment not successful', details: response.data.message || 'Unknown error' });
    }
    const raffle = await Raffle.findById(raffleId).catch(err => {
      console.error('MongoDB findById error:', err);
      throw new Error(`MongoDB error: ${err.message}`);
    });
    if (!raffle) {
      console.error('Raffle not found:', raffleId);
      return res.status(404).json({ error: 'Raffle not found' });
    }
    console.log('Raffle found:', raffle._id);
    await handleTicketGeneration(req, res, raffle, displayName, contact);
  } catch (err) {
    console.error('Verify payment error:', err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to verify payment', details: err.message });
    } else {
      console.warn('Headers already sent, cannot send error response');
    }
  }
};

// Get ticket by number
export const getTicketByNumber = async (req, res) => {
  console.log(`GET /api/raffles/${req.params.raffleId}/ticket/${req.params.ticketNumber}`);
  try {
    const { raffleId, ticketNumber } = req.params;
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    const participant = raffle.participants.find(p => p.ticketNumber === ticketNumber);
    if (!participant) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.status(200).json({ raffle, participant });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket', details: error.message });
  }
};

// Handle ticket generation
async function handleTicketGeneration(req, res, raffle, displayName, contact) {
  try {
    console.log('Starting ticket generation for raffle:', raffle._id, 'displayName:', displayName);
    const ticketNumber = crypto.randomBytes(8).toString('hex').toUpperCase();
    console.log('Generated ticket number:', ticketNumber);
    
    const qrCode = await generateQR(raffle._id.toString(), ticketNumber).catch(err => {
      console.error('QR code generation failed:', err);
      throw new Error(`QR code generation failed: ${err.message}`);
    });
    console.log('QR code generated successfully');
    
    raffle.participants.push({ displayName, contact, ticketNumber });
    await raffle.save().catch(err => {
      console.error('MongoDB save error:', err);
      throw new Error(`MongoDB save error: ${err.message}`);
    });
    console.log('Participant added to raffle and saved');
    
    const pdfBuffer = await generatePDF({ ticketNumber, raffleId: raffle._id, displayName, contact, qrCode }).catch(err => {
      console.error('PDF generation failed:', err);
      throw new Error(`PDF generation failed: ${err.message}`);
    });
    console.log('PDF generated successfully');
    
    if (res.headersSent) {
      console.warn('Headers already sent, cannot send PDF response');
      return;
    }
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=ticket-${ticketNumber}.pdf`,
      'X-Ticket-Number': ticketNumber,
    });
    console.log('Response headers set for PDF download');
    
    res.send(pdfBuffer);
    console.log('PDF sent in response');
  } catch (err) {
    console.error('Ticket generation error:', err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate ticket', details: err.message });
    } else {
      console.warn('Headers already sent, cannot send error response');
    }
  }
}

// Get raffle
export const getRaffle = async (req, res) => {
  console.log(`GET /api/raffles/${req.params.id}`);
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    res.status(200).json(raffle);
  } catch (err) {
    console.error('Get raffle error:', err);
    res.status(500).json({ error: 'Failed to fetch raffle', details: err.message });
  }
};

// Get all raffles
export const getAllRaffles = async (req, res) => {
  try {
    const raffles = await Raffle.find().sort({ createdAt: -1 });
    res.status(200).json(raffles);
  } catch (err) {
    console.error('Error fetching raffles:', err);
    res.status(500).json({ error: 'Failed to fetch raffles', details: err.message });
  }
};

// End raffle
export const endRaffle = async (req, res) => {
  const { id, secret } = req.params;
  console.log(`POST /api/raffles/end/${id}/${secret}`);
  try {
    const raffle = await Raffle.findById(id);
    if (!raffle) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    if (raffle.creatorSecret !== secret) {
      return res.status(403).json({ error: 'Unauthorized: Invalid creator secret' });
    }
    if (raffle.participants.length > 0) {
      const winnerIndex = Math.floor(Math.random() * raffle.participants.length);
      raffle.winner = raffle.participants[winnerIndex].ticketNumber;
    }
    raffle.endTime = new Date();
    await raffle.save();
    res.status(200).json({ winner: raffle.winner || null });
  } catch (err) {
    console.error('End raffle error:', err);
    res.status(500).json({ error: 'Failed to end raffle', details: err.message });
  }
};