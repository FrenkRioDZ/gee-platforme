const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"GEE Plateforme" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

// ─── Email Templates ──────────────────────────────────────────

const emailTemplates = {
  weeklyReminder: (userName, deadline) => ({
    subject: 'Rappel — Rapport Hebdomadaire à soumettre',
    html: `
      <h2>Bonjour ${userName},</h2>
      <p>Ce message est un rappel que votre <strong>rapport hebdomadaire</strong> doit être soumis avant le :</p>
      <h3 style="color:#d32f2f">${new Date(deadline).toLocaleString('fr-DZ')}</h3>
      <p>Connectez-vous à la plateforme GEE pour soumettre votre rapport.</p>
      <a href="${process.env.CLIENT_URL}" style="background:#1976d2;color:white;padding:10px 20px;border-radius:4px;text-decoration:none">
        Accéder à la plateforme
      </a>
    `
  }),

  reportSubmitted: (userName, projectName, weekLabel) => ({
    subject: `Rapport soumis — ${projectName} (${weekLabel})`,
    html: `
      <h2>Bonjour ${userName},</h2>
      <p>Un nouveau rapport hebdomadaire a été soumis pour le projet <strong>${projectName}</strong> — Semaine <strong>${weekLabel}</strong>.</p>
      <p>Merci de le consulter et de le valider sur la plateforme.</p>
      <a href="${process.env.CLIENT_URL}" style="background:#1976d2;color:white;padding:10px 20px;border-radius:4px;text-decoration:none">
        Consulter le rapport
      </a>
    `
  }),

  reportRejected: (userName, projectName, observation) => ({
    subject: `Rapport rejeté — ${projectName} — Action requise`,
    html: `
      <h2>Bonjour ${userName},</h2>
      <p>Votre rapport pour le projet <strong>${projectName}</strong> a été <strong style="color:#d32f2f">rejeté</strong> avec l'observation suivante :</p>
      <blockquote style="border-left:4px solid #d32f2f;padding-left:12px;color:#555">${observation}</blockquote>
      <p>Veuillez corriger et resoumettre votre rapport.</p>
      <a href="${process.env.CLIENT_URL}" style="background:#d32f2f;color:white;padding:10px 20px;border-radius:4px;text-decoration:none">
        Corriger le rapport
      </a>
    `
  }),

  reportAccepted: (userName, projectName, weekLabel) => ({
    subject: `Rapport accepté — ${projectName} (${weekLabel})`,
    html: `
      <h2>Bonjour ${userName},</h2>
      <p>Votre rapport hebdomadaire pour le projet <strong>${projectName}</strong> — Semaine <strong>${weekLabel}</strong> a été <strong style="color:#388e3c">accepté</strong>.</p>
    `
  }),

  reportLate: (userName, projectName) => ({
    subject: `Rapport en retard — ${projectName}`,
    html: `
      <h2>Bonjour ${userName},</h2>
      <p>Le délai de soumission pour le rapport du projet <strong>${projectName}</strong> est dépassé.</p>
      <p>Ce rapport est maintenant marqué comme <strong style="color:#d32f2f">En retard</strong>.</p>
    `
  })
};

module.exports = { sendEmail, emailTemplates };
