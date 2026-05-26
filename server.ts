import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing requests
  app.use(express.json());

  // API router for password recovery
  app.post("/api/send-recovery-email", async (req, res) => {
    const { email, name, resetLink } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "E-mail é obrigatório." });
    }

    const userName = name || "Usuário";
    
    // Check if customer-configured SMTP is present in environment
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser || "suporte-sistema@admincore.com.br";
    const displayName = smtpFrom.includes('@') ? smtpFrom.split('@')[0] : "Suporte";

    console.log(`[SMTP Recovery Flow] Initiated for: ${email}`);
    console.log(`[SMTP Diagnostics] Host: "${smtpHost}", Port: ${smtpPort}, User: "${smtpUser}", From: "${smtpFrom}", Pass Configured: ${smtpPass ? "Yes" : "No"}`);

    // Clean HTML email template matching the system's professional aesthetic
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recuperação de Senha</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f7f9fb;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            border: 1px solid #e4e7eb;
            box-shadow: 0 10px 30px rgba(0,0,0,0.02);
            overflow: hidden;
          }
          .header {
            background-color: #4d44e3;
            color: #ffffff;
            padding: 32px 40px;
            text-align: center;
          }
          .header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .header p {
            margin: 8px 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 40px;
            color: #191c1e;
            line-height: 1.6;
          }
          .content h3 {
            margin-top: 0;
            font-size: 18px;
            font-weight: 600;
            color: #191c1e;
          }
          .content p {
            font-size: 14px;
            color: #464555;
            margin-bottom: 24px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .btn-primary {
            display: inline-block;
            background-color: #4d44e3;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            font-size: 14px;
            font-weight: 750;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(77, 68, 227, 0.25);
            transition: all 0.2s ease;
          }
          .btn-primary:hover {
            background-color: #3d34d3;
            transform: translateY(-1px);
          }
          .url-box {
            background-color: #f2f4f6;
            border: 1px solid #e4e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 11px;
            color: #464555;
            word-break: break-all;
            margin-top: 24px;
          }
          .footer {
            background-color: #fafbfc;
            border-top: 1px solid #e4e7eb;
            padding: 24px 40px;
            text-align: center;
            font-size: 11px;
            color: #777587;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Central Administrativa</h2>
            <p>Gerenciamento de Lideranças & Cadastros</p>
          </div>
          <div class="content">
            <h3>Olá, ${userName}!</h3>
            <p>Recebemos uma solicitação para redefinir a senha associada ao seu e-mail corporativo (<strong>${email}</strong>).</p>
            <p>Para concluir este procedimento e definir uma nova senha segura de acesso, clique no botão abaixo:</p>
            
            <div class="button-container">
              <a href="${resetLink}" class="btn-primary" target="_blank">Redefinir Minha Senha</a>
            </div>

            <p style="font-size: 12px; color: #777587; margin-top: 32px;">Se o botão não funcionar, copie e cole o link completo abaixo em seu navegador de preferência:</p>
            <div class="url-box">${resetLink}</div>
          </div>
          <div class="footer">
            Este é um e-mail automático enviado pelo sistema. Favor não responder.<br>
            &copy; 2026 Central Administrativa de Lideranças de Campo.
          </div>
        </div>
      </body>
      </html>
    `;

    // Attempt to send using configured SMTP details
    if (smtpHost && smtpUser) {
      try {
        console.log(`[SMTP Recovery Flow] Initiated transport verification for: ${smtpHost}:${smtpPort}`);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465, // True for 465, false for 587 and others
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 10000, // 10 seconds timeout
          greetingTimeout: 10000,   // 10 seconds timeout
          socketTimeout: 15000       // 15 seconds socket timeout
        });

        // Test the connection before sending
        await transporter.verify();
        console.log("[SMTP Recovery Flow] Connection successfully verified with SMTP mail relay!");

        const info = await transporter.sendMail({
          from: `"${displayName}" <${smtpFrom}>`,
          to: email,
          subject: "Recuperação de Senha - Central Administrativa",
          html: emailHtml
        });

        console.log(`[SMTP Recovery Flow] Email sent successfully via SMTP! Message ID: ${info.messageId}`);
        return res.json({ 
          success: true, 
          method: "smtp", 
          recipient: email, 
          messageId: info.messageId 
        });
      } catch (smtpErr: any) {
        console.error("[SMTP Recovery Flow] Connection/Send via SMTP failed in node server:", smtpErr);
        return res.status(500).json({ 
          success: false, 
          error: `Erro de conexão SMTP no servidor (${smtpHost}): ${smtpErr.message || smtpErr}` 
        });
      }
    }

    // Fallback if SMTP parameters are missing: use a dynamic test ethereal service account
    try {
      console.log("[SMTP Recovery Flow] Real SMTP credentials not found. Generating an Ethereal Account Sandbox...");
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      const info = await transporter.sendMail({
        from: `"${displayName}" <${smtpFrom}>`,
        to: email,
        subject: "Recuperação de Senha - Central Administrativa (Ambiente de Testes)",
        html: emailHtml
      });

      const testUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[SMTP Recovery Flow] Demo Email Sent!`);
      console.log(`[SMTP Recovery Flow] Recipient: ${email}`);
      console.log(`[SMTP Recovery Flow] View Ethereal Mail URL: ${testUrl}`);

      return res.json({
        success: true,
        method: "ethereal",
        testUrl: testUrl,
        recipient: email,
        message: "SMTP de produção não configurado no .env. Enviado usando o ambiente de testes Ethereal!"
      });
    } catch (etherealErr: any) {
      console.error("[SMTP Recovery Flow] Ethereal fallback failed:", etherealErr);
      // Terminal logging as safe extreme fallback
      console.log("\n==================================================");
      console.log("             FALLBACK EMAIL EMULATION             ");
      console.log(`De: ${smtpFrom}`);
      console.log(`Para: ${email}`);
      console.log(`Link de redefinição: ${resetLink}`);
      console.log("==================================================\n");

      return res.json({
        success: true,
        method: "console",
        recipient: email,
        message: "O e-mail foi impresso no console do servidor devido à ausência de internet ou servidor SMTP de testes."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
