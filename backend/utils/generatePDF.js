import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import JSZip from 'jszip';

async function generatePDF({ ticketNumbers, raffleId, displayName, contact, qrCodes }) {
  console.log('Generating PDFs for ticket numbers:', ticketNumbers);
  const zip = new JSZip();

  for (let i = 0; i < ticketNumbers.length; i++) {
    const ticketNumber = ticketNumbers[i];
    const qrCode = qrCodes[i];
    const doc = new PDFDocument();
    let buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    doc.fontSize(20).text('Raffle Ticket', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Raffle ID: ${raffleId}`);
    doc.text(`Ticket Number: ${ticketNumber}`);
    doc.text(`Name: ${displayName}`);
    doc.text(`Contact: ${contact}`);
    doc.moveDown();
    doc.image(qrCode, { fit: [100, 100], align: 'center', valign: 'center' });

    doc.end();

    const pdfBuffer = await new Promise((resolve) => {
      let buffer = Buffer.from([]);
      doc.on('data', (chunk) => (buffer = Buffer.concat([buffer, chunk])));
      doc.on('end', () => resolve(buffer));
    });

    zip.file(`ticket-${ticketNumber}.pdf`, pdfBuffer);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log('ZIP file generated for tickets:', ticketNumbers);
  return zipBuffer;
}

export default generatePDF;