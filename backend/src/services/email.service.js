const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter = null;
if (config.smtp && config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port || 587,
    secure: config.smtp.port === 465,
    auth: config.smtp.user
      ? {
          user: config.smtp.user,
          pass: config.smtp.pass,
        }
      : undefined,
  });
}

const isConfigured = () => !!transporter;

const send = async (to, subject, text, html) => {
  if (!transporter) {
    throw new Error('SMTP not configured');
  }
  const from = config.smtp.from || `no-reply@${config.frontendUrl.replace(/^https?:\/\//, '')}`;
  return transporter.sendMail({ from, to, subject, text, html });
};

module.exports = {
  isConfigured,
  send,
};
