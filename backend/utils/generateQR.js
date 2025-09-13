import QRCode from 'qrcode';

const generateQR = async (raffleId, ticketNumber) => {
  try {
    const FRONTEND = process.env.FRONTEND_LINK | process.env.FRONTEND_LINK2;
    const url = FRONTEND + `/ticket/${raffleId}?ticketNumber=${ticketNumber}`;
    const qrCode = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
    });
    console.log('Generated QR code data URL:', qrCode.substring(0, 50) + '...');
    return qrCode;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

export default generateQR;