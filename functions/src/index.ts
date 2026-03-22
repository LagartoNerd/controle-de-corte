import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { MercadoPagoConfig, Preference, PreApproval } from 'mercadopago';
import * as cors from 'cors';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

// ID do Firestore customizado — mesmo do app
const FIRESTORE_DB = 'ai-studio-17c1e69d-5bc9-4943-b15e-b17fa5fd8f58';

const corsHandler = cors({ origin: true });

// ─── Helper: buscar config global do Firestore ────────────────────────────────
async function getGlobalConfig() {
  const snap = await db.collection('config').doc('global').get();
  if (!snap.exists) throw new Error('Configuração global não encontrada no Firestore.');
  return snap.data() as Record<string, any>;
}

// ─── Helper: atualizar plano do usuário no Firestore ─────────────────────────
async function activateUserPlan(
  userId: string,
  plan: string,
  subscriptionId: string | null,
  isTrial: boolean
) {
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    plan,
    subscriptionId: subscriptionId || null,
    hasUsedTrial: isTrial ? true : admin.firestore.FieldValue.delete(),
    trialStartDate: isTrial ? new Date().toISOString() : null,
    trialPlan: isTrial ? plan : null,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO — Criar assinatura recorrente (com 15 dias de trial)
// ─────────────────────────────────────────────────────────────────────────────
export const mpCreateSubscription = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido.' });
      return;
    }

    const { planId, planName, price, userEmail, userId } = req.body;

    if (!planId || !price || !userEmail || !userId) {
      res.status(400).json({ error: 'Parâmetros obrigatórios: planId, price, userEmail, userId.' });
      return;
    }

    try {
      const config = await getGlobalConfig();
      const accessToken: string = config.mercadopagoAccessToken;

      if (!accessToken) {
        res.status(400).json({ error: 'Access Token do Mercado Pago não configurado no painel admin.' });
        return;
      }

      const client = new MercadoPagoConfig({ accessToken });
      const preApproval = new PreApproval(client);

      const result = await preApproval.create({
        body: {
          reason: `Assinatura ${planName} - Controle de Corte`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: price,
            currency_id: 'BRL',
            free_trial: {
              frequency: 15,
              frequency_type: 'days',
            },
          } as any,
          // deep_link para retornar ao app após pagamento
          back_url: `controlecorte://payment/success?plan=${planId}&userId=${userId}`,
          payer_email: userEmail,
          external_reference: `${userId}|${planId}`,
          status: 'pending',
        },
      });

      // Salva o subscriptionId no Firestore já aguardando ativação
      await db.collection('users').doc(userId).update({
        pendingSubscriptionId: result.id,
        pendingPlan: planId,
        updatedAt: new Date().toISOString(),
      });

      res.json({
        subscriptionId: result.id,
        checkoutUrl: result.init_point, // abre no navegador/WebView do app
      });
    } catch (error: any) {
      console.error('Erro mpCreateSubscription:', error);
      res.status(500).json({ error: error.message || 'Erro ao criar assinatura.' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO — Criar preferência avulsa (pagamento único)
// ─────────────────────────────────────────────────────────────────────────────
export const mpCreatePreference = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }

    const { planId, planName, price, userEmail, userId } = req.body;
    if (!planId || !price || !userEmail || !userId) {
      res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' }); return;
    }

    try {
      const config = await getGlobalConfig();
      const accessToken: string = config.mercadopagoAccessToken;
      if (!accessToken) { res.status(400).json({ error: 'Access Token MP não configurado.' }); return; }

      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);

      const result = await preference.create({
        body: {
          items: [{
            id: planId,
            title: `Plano ${planName} - Controle de Corte`,
            quantity: 1,
            unit_price: price,
            currency_id: 'BRL',
          }],
          payer: { email: userEmail },
          back_urls: {
            success: `controlecorte://payment/success?plan=${planId}&userId=${userId}`,
            failure: `controlecorte://payment/failure`,
            pending: `controlecorte://payment/pending`,
          },
          auto_return: 'approved',
          external_reference: `${userId}|${planId}`,
          notification_url: `https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/mpWebhook`,
        },
      });

      res.json({ preferenceId: result.id, checkoutUrl: result.init_point });
    } catch (error: any) {
      console.error('Erro mpCreatePreference:', error);
      res.status(500).json({ error: error.message || 'Erro ao criar preferência.' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO — Cancelar assinatura
// ─────────────────────────────────────────────────────────────────────────────
export const mpCancelSubscription = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }

    const { userId, subscriptionId } = req.body;
    if (!userId || !subscriptionId) { res.status(400).json({ error: 'userId e subscriptionId obrigatórios.' }); return; }

    try {
      const config = await getGlobalConfig();
      const accessToken: string = config.mercadopagoAccessToken;
      if (!accessToken) { res.status(400).json({ error: 'Access Token MP não configurado.' }); return; }

      const client = new MercadoPagoConfig({ accessToken });
      const preApproval = new PreApproval(client);

      await preApproval.update({
        id: subscriptionId,
        body: { status: 'cancelled' },
      });

      // Rebaixa o usuário para free no Firestore
      await db.collection('users').doc(userId).update({
        plan: 'free',
        subscriptionId: null,
        trialStartDate: null,
        trialPlan: null,
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro mpCancelSubscription:', error);
      res.status(500).json({ error: error.message || 'Erro ao cancelar assinatura.' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO — Webhook (notificação automática de pagamento aprovado)
// Configura este URL no painel do MP em: Configurações > Webhooks
// URL: https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/mpWebhook
// ─────────────────────────────────────────────────────────────────────────────
export const mpWebhook = functions.https.onRequest(async (req, res) => {
  // MP envia GET para validar e POST com dados
  if (req.method === 'GET') { res.sendStatus(200); return; }
  if (req.method !== 'POST') { res.sendStatus(405); return; }

  try {
    const { type, data } = req.body;

    // Pagamento aprovado
    if (type === 'payment') {
      const paymentId = data?.id;
      if (!paymentId) { res.sendStatus(400); return; }

      const config = await getGlobalConfig();
      const accessToken: string = config.mercadopagoAccessToken;
      const client = new MercadoPagoConfig({ accessToken });

      // Busca detalhes do pagamento na API do MP
      const response = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const payment = response.data;

      if (payment.status === 'approved') {
        // external_reference = "userId|planId"
        const [userId, planId] = (payment.external_reference || '').split('|');
        if (userId && planId) {
          await activateUserPlan(userId, planId, payment.id, true);
          console.log(`✅ Plano ${planId} ativado para usuário ${userId} via webhook MP`);
        }
      }
    }

    // Assinatura atualizada (preapproval)
    if (type === 'subscription_preapproval') {
      const subscriptionId = data?.id;
      if (!subscriptionId) { res.sendStatus(400); return; }

      const config = await getGlobalConfig();
      const accessToken: string = config.mercadopagoAccessToken;

      const response = await axios.get(
        `https://api.mercadopago.com/preapproval/${subscriptionId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const subscription = response.data;
      const [userId, planId] = (subscription.external_reference || '').split('|');

      if (userId && planId) {
        if (subscription.status === 'authorized') {
          await activateUserPlan(userId, planId, subscriptionId, true);
          console.log(`✅ Assinatura ${planId} ativada para ${userId}`);
        } else if (subscription.status === 'cancelled') {
          await db.collection('users').doc(userId).update({
            plan: 'free', subscriptionId: null,
            trialStartDate: null, trialPlan: null,
            updatedAt: new Date().toISOString(),
          });
          console.log(`❌ Assinatura cancelada para ${userId}`);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Erro no webhook MP:', error);
    res.sendStatus(500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO — Ativar plano manualmente após retorno deep link
// Chamada pelo app quando recebe controlecorte://payment/success
// ─────────────────────────────────────────────────────────────────────────────
export const mpActivatePlan = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }

    const { userId, planId, subscriptionId } = req.body;
    if (!userId || !planId) { res.status(400).json({ error: 'userId e planId obrigatórios.' }); return; }

    try {
      await activateUserPlan(userId, planId, subscriptionId || null, true);
      res.json({ success: true, plan: planId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAGSEGURO — Criar checkout
// ─────────────────────────────────────────────────────────────────────────────
export const pagseguroCreateCheckout = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }

    const { planId, planName, price, userEmail, userId } = req.body;
    if (!planId || !price || !userEmail || !userId) {
      res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' }); return;
    }

    try {
      const config = await getGlobalConfig();
      const token: string = config.pagseguroToken;
      const email: string = config.pagseguroEmail;

      if (!token || !email) {
        res.status(400).json({ error: 'Credenciais PagSeguro não configuradas no painel admin.' }); return;
      }

      const params = new URLSearchParams();
      params.append('email', email);
      params.append('token', token);
      params.append('currency', 'BRL');
      params.append('itemId1', planId);
      params.append('itemDescription1', `Assinatura ${planName} - Controle de Corte`);
      params.append('itemAmount1', Number(price).toFixed(2));
      params.append('itemQuantity1', '1');
      params.append('reference', `${userId}|${planId}`);
      params.append('redirectURL', `controlecorte://payment/success?plan=${planId}&userId=${userId}`);
      params.append('notificationURL', `https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pagseguroWebhook`);

      const response = await axios.post(
        'https://ws.pagseguro.uol.com.br/v2/checkout',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const codeMatch = response.data.match(/<code>(.*?)<\/code>/);
      if (!codeMatch) throw new Error('PagSeguro não retornou código de checkout.');

      const checkoutUrl = `https://pagseguro.uol.com.br/v2/checkout/payment.html?code=${codeMatch[1]}`;
      res.json({ checkoutUrl, code: codeMatch[1] });
    } catch (error: any) {
      console.error('Erro pagseguroCreateCheckout:', error?.response?.data || error.message);
      res.status(500).json({ error: 'Erro ao criar checkout PagSeguro.' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAGSEGURO — Webhook (notificação de pagamento)
// Configura em: Painel PagSeguro > Configurações > Notificações
// URL: https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pagseguroWebhook
// ─────────────────────────────────────────────────────────────────────────────
export const pagseguroWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.sendStatus(405); return; }

  try {
    const notificationCode = req.body.notificationCode;
    const notificationType = req.body.notificationType;

    if (notificationType !== 'transaction' || !notificationCode) {
      res.sendStatus(200); return;
    }

    const config = await getGlobalConfig();
    const token: string = config.pagseguroToken;
    const email: string = config.pagseguroEmail;

    // Consulta detalhes da transação
    const response = await axios.get(
      `https://ws.pagseguro.uol.com.br/v3/transactions/notifications/${notificationCode}?email=${email}&token=${token}`
    );

    const xmlData: string = response.data;

    // Extrai status e referência do XML do PagSeguro
    const statusMatch = xmlData.match(/<status>(\d+)<\/status>/);
    const refMatch = xmlData.match(/<reference>(.*?)<\/reference>/);

    const status = statusMatch ? parseInt(statusMatch[1]) : 0;
    const reference = refMatch ? refMatch[1] : '';

    // Status 3 = Pago, 4 = Disponível
    if ((status === 3 || status === 4) && reference) {
      const [userId, planId] = reference.split('|');
      if (userId && planId) {
        await activateUserPlan(userId, planId, notificationCode, true);
        console.log(`✅ Plano ${planId} ativado para ${userId} via PagSeguro`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Erro pagseguroWebhook:', error);
    res.sendStatus(500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PIX — Gerar cobrança via Efí Bank (Gerencianet)
// Para outros bancos (Inter, Itaú), a estrutura OAuth + Cob é a mesma
// ─────────────────────────────────────────────────────────────────────────────
export const pixCreateCharge = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }

    const { price, userId, planId } = req.body;
    if (!price || !userId || !planId) {
      res.status(400).json({ error: 'price, userId e planId obrigatórios.' }); return;
    }

    try {
      const config = await getGlobalConfig();
      const pixClientId: string = config.pixClientId;
      const pixClientSecret: string = config.pixClientSecret;
      const pixKey: string = config.pixKey;

      if (!pixClientId || !pixClientSecret || !pixKey) {
        res.status(400).json({ error: 'Credenciais PIX não configuradas no painel admin.' }); return;
      }

      // 1. OAuth — obter token de acesso Efí Bank
      const oauthResponse = await axios.post(
        'https://pix.api.efipay.com.br/oauth/token',
        { grant_type: 'client_credentials' },
        {
          auth: { username: pixClientId, password: pixClientSecret },
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const accessToken: string = oauthResponse.data.access_token;

      // 2. Criar cobrança PIX imediata (cob)
      const txid = `CC${userId.substring(0, 10)}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 35);

      const cobResponse = await axios.put(
        `https://pix.api.efipay.com.br/v2/cob/${txid}`,
        {
          calendario: { expiracao: 3600 }, // 1 hora
          devedor: { cpf: '00000000000', nome: 'Cliente' }, // substituir com dados reais se disponível
          valor: { original: Number(price).toFixed(2) },
          chave: pixKey,
          solicitacaoPagador: `Plano ${planId} - Controle de Corte`,
          infoAdicionais: [{ nome: 'userId', valor: userId }, { nome: 'planId', valor: planId }],
        },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );

      const cob = cobResponse.data;

      // 3. Gerar QR Code
      const qrResponse = await axios.get(
        `https://pix.api.efipay.com.br/v2/loc/${cob.loc.id}/qrcode`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      // Salva txid no Firestore aguardando confirmação
      await db.collection('pix_pending').doc(txid).set({
        userId, planId, price, txid,
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      res.json({
        txid,
        pixCopiaECola: qrResponse.data.qrcode,
        qrCodeImageUrl: qrResponse.data.imagemQrcode,
        expiresIn: 3600,
      });
    } catch (error: any) {
      console.error('Erro pixCreateCharge:', error?.response?.data || error.message);
      res.status(500).json({ error: 'Erro ao gerar cobrança PIX.' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PIX — Webhook Efí Bank (confirmação automática de pagamento)
// Configura no painel Efí: Minha Conta > Configurações > Webhooks PIX
// URL: https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pixWebhook
// ─────────────────────────────────────────────────────────────────────────────
export const pixWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.sendStatus(405); return; }

  try {
    const { pix } = req.body;
    if (!pix || !Array.isArray(pix)) { res.sendStatus(200); return; }

    for (const payment of pix) {
      const { txid, status } = payment;
      if (!txid) continue;

      // Busca registro pendente no Firestore
      const pendingSnap = await db.collection('pix_pending').doc(txid).get();
      if (!pendingSnap.exists) continue;

      const pending = pendingSnap.data()!;

      if (status === 'CONCLUIDA' || payment.endToEndId) {
        // Pagamento PIX confirmado — ativa plano
        await activateUserPlan(pending.userId, pending.planId, txid, true);
        await db.collection('pix_pending').doc(txid).update({ status: 'paid', paidAt: new Date().toISOString() });
        console.log(`✅ PIX confirmado — plano ${pending.planId} ativado para ${pending.userId}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Erro pixWebhook:', error);
    res.sendStatus(500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICAR STATUS DE PAGAMENTO PIX (polling do app)
// ─────────────────────────────────────────────────────────────────────────────
export const pixCheckStatus = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Método não permitido.' }); return; }

    const { txid, userId } = req.query as { txid: string; userId: string };
    if (!txid || !userId) { res.status(400).json({ error: 'txid e userId obrigatórios.' }); return; }

    try {
      const pendingSnap = await db.collection('pix_pending').doc(txid).get();
      if (!pendingSnap.exists) { res.json({ status: 'not_found' }); return; }

      const data = pendingSnap.data()!;
      res.json({ status: data.status, planId: data.planId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED — Verificar trials expirados (roda todo dia às 00:00)
// ─────────────────────────────────────────────────────────────────────────────
export const checkExpiredTrials = functions.scheduler
  .onSchedule('every 24 hours')
  .onRun(async () => {
    const usersSnap = await db.collection('users')
      .where('trialStartDate', '!=', null)
      .get();

    const now = new Date();
    const promises: Promise<any>[] = [];

    usersSnap.forEach(docSnap => {
      const user = docSnap.data();
      if (!user.trialStartDate || !user.trialPlan) return;

      const trialStart = new Date(user.trialStartDate);
      const diffDays = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 15) {
        // Trial expirado — converte para plano pago automaticamente
        promises.push(
          docSnap.ref.update({
            plan: user.trialPlan,
            trialStartDate: null,
            trialPlan: null,
            updatedAt: now.toISOString(),
          })
        );
        console.log(`⏰ Trial expirado — plano ${user.trialPlan} ativado para ${docSnap.id}`);
      }
    });

    await Promise.all(promises);
    console.log(`✅ Verificação de trials concluída. ${promises.length} usuário(s) convertido(s).`);
  });
