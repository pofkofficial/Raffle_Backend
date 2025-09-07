import mongoose from 'mongoose';

const RaffleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  prizeTypes: { type: [String], required: true, enum: ['cash', 'item'] }, // Array of prize types
  cashPrize: { type: Number, required: function() { return this.prizeTypes.includes('cash'); } },
  itemName: { type: String, required: function() { return this.prizeTypes.includes('item'); } },
  prizeImage: { type: String, required: function() { return this.prizeTypes.includes('item'); } },
  ticketPrice: { type: Number, required: true },
  endTime: { type: Date, required: true },
  createdBy: { type: String, required: true },
  creatorSecret: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  participants: [{
    displayName: { type: String, required: true },
    contact: { type: String, required: true },
    ticketNumber: { type: String, required: true, unique: true },
  }],
  winner: { type: String },
});

export default mongoose.model('Raffle', RaffleSchema);