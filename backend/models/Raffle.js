import mongoose from 'mongoose';

const RaffleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  cashPrize: { type: Number, required: true },
  ticketPrice: { type: Number, required: true },
  endTime: { type: Date, required: true },
  prizeImage: { type: String },
  createdBy: { type: String },
  creatorSecret: { type: String, required: true },
  participants: [{
    displayName: { type: String, required: true },
    contact: { type: String, required: true },
    ticketNumber: { type: String, required: true },
  }],
  winner: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Raffle', RaffleSchema);