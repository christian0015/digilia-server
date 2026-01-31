// emailService.js
const nodemailer = require('nodemailer');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Utilisez un mot de passe d'application
  },
});

// Fonction pour envoyer des emails
const sendEmail = async ({ email, subject, html }) => {
  try {
    const mailOptions = {
      from: `"Digilia" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email envoyé:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erreur d\'envoi d\'email:', error);
    throw error;
  }
};

module.exports = sendEmail;