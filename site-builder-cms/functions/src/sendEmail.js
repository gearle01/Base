// Este arquivo conteria a lógica para enviar e-mails transacionais.
// Por exemplo, um e-mail de boas-vindas para um novo cliente ou uma notificação.

function sendEmail(to, subject, body) {
    console.log(`Enviando e-mail para ${to}...`);
    console.log(`Assunto: ${subject}`);
    console.log(`Corpo: ${body}`);
    // Lógica de envio de e-mail aqui (usando um serviço como SendGrid, Mailgun, etc.)
}

module.exports = { sendEmail };
