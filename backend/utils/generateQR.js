import QRCode from 'qrcode';

const generateQR = async (raffleId, ticketNumber) => {
  try {
    const ticketUrl = `http://localhost:3000/ticket/${raffleId}?ticketNumber=${encodeURIComponent(ticketNumber)}`;
    const qrCode = await QRCode.toBuffer(ticketUrl);
    console.log('Generated QR code Buffer:', qrCode.length, 'bytes');
    return qrCode;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw new Error('Failed to generate QR code');
  }
};

export default generateQR;