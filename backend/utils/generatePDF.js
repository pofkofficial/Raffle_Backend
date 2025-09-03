import PDFDocument from 'pdfkit';

const generatePDF = (raffle, participant, qrCode, callback) => {
  try {
    const doc = new PDFDocument();
    callback(doc); // Pipe the document to the response

    doc.fontSize(20).text('Raffle Ticket', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Title: ${raffle.title}`);
    doc.text(`Ticket Number: ${participant.ticketNumber}`);
    doc.text(`Name: ${participant.displayName}`);
    doc.text(`Contact: ${participant.contact}`);
    doc.moveDown();

    // Ensure qrCode is a Buffer and add it to the PDF
    if (!(qrCode instanceof Buffer)) {
      throw new Error('QR code must be a Buffer');
    }
    console.log('Adding QR code to PDF:', qrCode.length, 'bytes');
    doc.image(qrCode, { fit: [100, 100], align: 'center' });

    // Finalize the document
    doc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    throw new Error('Failed to generate PDF: ' + err.message);
  }
};

export default generatePDF;