import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

async function generatePDF({ ticketNumber, raffleId, displayName, contact, qrCode }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('Raffle Ticket', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Raffle ID: ${raffleId}`);
      doc.text(`Ticket Number: ${ticketNumber}`);
      doc.text(`Name: ${displayName}`);
      doc.text(`Contact: ${contact}`);
      doc.moveDown();

      // Ensure qrCode is a data URL and add it to the PDF
      if (typeof qrCode !== 'string' || !qrCode.startsWith('data:image/')) {
        throw new Error('QR code must be a valid data URL');
      }
      console.log('Adding QR code to PDF:', qrCode.slice(0, 50) + '...');
      doc.image(qrCode, { fit: [100, 100], align: 'center' });

      // Finalize the document
      doc.end();
    } catch (err) {
      console.error('Error generating PDF:', err);
      reject(new Error('Failed to generate PDF: ' + err.message));
    }
  });
}

export default generatePDF;