const notifyTo = process.env.EMAIL_NOTIFY_TO || 'lpaulo.alvim@hotmail.com';

function emailEnabled() {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_FROM);
}

export async function notifyUserRegistration(user) {
  if (!emailEnabled()) {
    console.warn('[email] SMTP nao configurado; notificacao de cadastro ignorada com seguranca.');
    return { sent: false, skipped: true };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: notifyTo,
      subject: 'Novo cadastro - Controle Inteligente de PDM SAP',
      text: [
        'Novo usuario cadastrado no Controle Inteligente de PDM SAP.',
        '',
        `Nome completo: ${user.name}`,
        `Login gerado: ${user.username}`,
        `E-mail informado: ${user.email}`,
        `Data e hora do cadastro: ${new Date().toLocaleString('pt-BR')}`,
        `Perfil criado: ${user.role}`,
        'Origem: Controle Inteligente de PDM SAP'
      ].join('\n')
    });

    return { sent: true };
  } catch (error) {
    console.error('[email] Falha segura ao enviar notificacao de cadastro:', error.message);
    return { sent: false, error: error.message };
  }
}
