# Guia de Configuração — Pagamentos e AdMob

---

## ✅ O que foi implementado

### Cloud Functions (functions/src/index.ts)
| Function | Descrição |
|---|---|
| `mpCreateSubscription` | Cria assinatura recorrente com 15 dias grátis no MP |
| `mpCreatePreference` | Cria pagamento avulso no MP |
| `mpCancelSubscription` | Cancela assinatura e rebaixa para Free no Firestore |
| `mpActivatePlan` | Ativa plano após retorno do deep link |
| `mpWebhook` | Recebe notificações automáticas do MP (aprovado/cancelado) |
| `pagseguroCreateCheckout` | Cria checkout no PagSeguro |
| `pagseguroWebhook` | Recebe notificações do PagSeguro |
| `pixCreateCharge` | Gera cobrança PIX via Efí Bank |
| `pixWebhook` | Confirma pagamento PIX automaticamente |
| `pixCheckStatus` | Polling de status PIX pelo app |
| `checkExpiredTrials` | Job diário que converte trials expirados em planos pagos |

### Fluxo completo de pagamento
```
Usuário escolhe plano → CheckoutScreen
  → Mercado Pago: abre browser → usuário paga → retorna via deep link → mpActivatePlan → Firestore atualizado
  → PagSeguro: abre browser → usuário paga → webhook automático → Firestore atualizado
  → PIX: gera QR Code → usuário paga → webhook Efí → Firestore atualizado (ou polling a cada 5s)
```

---

## 🚀 Como fazer o deploy das Cloud Functions

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Inicializar projeto Firebase
```bash
firebase use ai-studio-applet-webapp-91ce3
```

### 3. Instalar dependências das functions
```bash
cd functions
npm install
cd ..
```

### 4. Build e deploy
```bash
cd functions && npm run build && cd ..
firebase deploy --only functions
```

Após o deploy, as URLs das functions serão:
```
https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/mpCreateSubscription
https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/mpWebhook
https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pagseguroWebhook
https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pixWebhook
etc.
```

---

## 💳 Configuração Mercado Pago

### No painel do app (Admin > Configurações):
1. Ative "Mercado Pago"
2. Cole o **Access Token** (começa com `APP_USR-...`) — encontrado em:
   `Mercado Pago Developers → Suas integrações → Credenciais de produção`

### Configurar Webhook no painel MP:
1. Acesse: https://www.mercadopago.com.br/developers/panel/webhooks
2. Clique em "Adicionar"
3. Cole a URL: `https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/mpWebhook`
4. Eventos: marque **"Pagamentos"** e **"Assinaturas"**

---

## 🛡 Configuração PagSeguro

### No painel do app (Admin > Configurações):
1. Ative "PagSeguro"
2. Cole seu **E-mail PagSeguro** e **Token** (encontrado em Minha Conta > Preferências > Integrações)

### Configurar Notificações no PagSeguro:
1. Acesse: https://pagseguro.uol.com.br/aplicacao/notificacoes.jhtml
2. URL de retorno: `https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pagseguroWebhook`

---

## ⚡ Configuração PIX (Efí Bank)

### Criar conta na Efí:
1. Acesse: https://sejaefi.com.br
2. Crie uma conta e ative o produto **PIX**
3. Vá em **API > Minhas Aplicações** → crie um aplicativo
4. Anote: `Client ID` e `Client Secret`

### No painel do app (Admin > Configurações):
1. Ative "PIX"
2. Preencha: **Chave PIX**, **Client ID**, **Client Secret**

### Configurar Webhook PIX na Efí:
1. Acesse: Painel Efí → API → Configurar Webhook
2. URL: `https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net/pixWebhook`

---

## 📢 Configuração AdMob

### 1. Criar App no AdMob:
1. Acesse: https://apps.admob.com
2. Adicione um novo app → Android → Cole o nome "Controle de Corte"
3. Anote o **App ID** (formato: `ca-app-pub-XXXXXXXX~XXXXXXXXXX`)

### 2. Criar blocos de anúncio:
- Crie um bloco **Banner** → anote o ID (formato: `ca-app-pub-XXXXXXXX/XXXXXXXXXX`)
- Crie um bloco **Interstitial** → anote o ID

### 3. Configurar no código:

**android/app/src/main/res/values/strings.xml** — substitua o admob_app_id:
```xml
<string name="admob_app_id">ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
```

**android/app/src/main/AndroidManifest.xml** — adicione dentro de `<application>`:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="@string/admob_app_id"/>
```

### 4. Configurar no painel Admin do app:
1. Ative "AdMob"
2. Cole o ID do bloco **Banner**
3. Cole o ID do bloco **Interstitial**

### IDs de teste (já configurados para desenvolvimento):
- Banner: `ca-app-pub-3940256099942544/6300978111`
- Interstitial: `ca-app-pub-3940256099942544/1033173712`

> ⚠️ Os IDs de teste são ativados automaticamente quando `__DEV__ === true` (durante desenvolvimento). Substitua pelos IDs reais apenas para produção via painel Admin.

---

## 🔗 Deep Link (retorno de pagamento)

### AndroidManifest.xml — adicione dentro de `<activity android:name=".MainActivity">`:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="controlecorte" android:host="payment" />
</intent-filter>
```

---

## 📋 Checklist final antes de publicar

- [ ] Deploy das Cloud Functions feito
- [ ] Webhook MP configurado no painel MP
- [ ] Webhook PagSeguro configurado
- [ ] Webhook PIX configurado na Efí
- [ ] `strings.xml` com App ID AdMob real
- [ ] `AndroidManifest.xml` com meta-data AdMob e intent-filter deep link
- [ ] Painel Admin: preencher todos os tokens, chaves e IDs
- [ ] Testar fluxo completo em sandbox/homologação antes de produção
- [ ] SHA-1 do keystore de release cadastrado no Firebase Console para Google Sign-In
