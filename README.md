# Controle de Corte — React Native (Android)

App 100% nativo Android migrado do Capacitor/Web para React Native.

---

## 📦 Stack
- **React Native 0.75** — framework nativo
- **Firebase JS SDK 10** — Firestore, Auth, Storage (mesma config do original)
- **React Navigation 6** — Stack + Drawer
- **AsyncStorage** — persistência de sessão (substitui localStorage)
- **react-native-vector-icons** — ícones nativos
- **react-native-chart-kit** — gráficos nativos
- **react-native-image-picker** — câmera/galeria nativa
- **@react-native-google-signin/google-signin** — Google Auth nativo

---

## 🚀 Setup

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar Firebase
O arquivo `src/firebase.ts` já contém as credenciais do projeto original.
Se quiser usar um novo projeto, substitua os valores em `firebaseConfig`.

### 3. Configurar Google Sign-In
No arquivo `src/screens/AuthScreen.tsx`, substitua:
```ts
webClientId: 'SEU_WEB_CLIENT_ID_AQUI.apps.googleusercontent.com'
```
Pelo seu Web Client ID do Firebase Console → Authentication → Google.

### 4. Link de ícones vetoriais (react-native-vector-icons)
Adicione no `android/app/build.gradle`:
```gradle
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

### 5. Rodar no Android
```bash
# Iniciar Metro bundler
npm start

# Em outro terminal, rodar no dispositivo/emulador
npm run android
```

### 6. Gerar APK Release
```bash
cd android
./gradlew assembleRelease
# APK gerado em: android/app/build/outputs/apk/release/app-release.apk
```

---

## 📁 Estrutura do Projeto

```
src/
├── firebase.ts          # Config Firebase (idêntica ao original)
├── types.ts             # Tipos TypeScript (idênticos ao original)
├── theme/
│   └── index.ts         # Cores, espaçamentos, estilos globais
├── navigation/
│   └── AppNavigator.tsx # Stack + Drawer navigation
├── utils/
│   ├── fortnight.ts     # Lógica de quinzenas (idêntica)
│   └── error.ts         # Tratamento de erros Firestore
├── components/
│   └── ConfirmModal.tsx # Modal de confirmação nativo
└── screens/
    ├── AuthScreen.tsx          # Login/Cadastro/Google
    ├── DashboardScreen.tsx     # Dashboard
    ├── ClientsScreen.tsx       # Clientes CRUD
    ├── ClientFinanceScreen.tsx # Financeiro por cliente
    ├── FortnightDetailsScreen.tsx # Detalhes da quinzena
    ├── ModelsScreen.tsx        # Modelos CRUD
    ├── ModelDetailsScreen.tsx  # Cores/Materiais/Moldes
    ├── DailySheetsListScreen.tsx # Lista de fichas
    ├── DailySheetFormScreen.tsx  # Ficha do dia (formulário completo)
    ├── ReportsScreen.tsx       # Relatórios + gráficos + exportação
    ├── PricingScreen.tsx       # Planos
    ├── CheckoutScreen.tsx      # Checkout
    ├── AdminUsersScreen.tsx    # Admin: usuários
    └── AdminConfigScreen.tsx   # Admin: configurações
```

---

## ✅ O que foi mantido idêntico ao original
- Toda a lógica Firestore (queries, batches, listeners)
- Estrutura de dados (collections, campos)
- Lógica de quinzenas (fortnight.ts)
- Controle de planos e limites
- Admin panel completo
- Verificação e expiração de trial

## ❌ O que foi removido (código web desnecessário)
- `window.location.search` / URL params (substituído por navegação nativa)
- `window.print()` → substituído por `Share.share()`
- `document.createElement('canvas')` → substituído por `react-native-image-picker`
- `AdBanner` / `AppOpenAd` simulados → podem ser integrados com `@react-native-google-mobile-ads`
- `AppIconManager` → não aplicável em nativo
- `capacitor.config.ts`, `vite.config.ts`, `server.ts` → removidos
- `motion/react` animations → substituídas por animações nativas do RN

## 🔄 AdMob Real (opcional)
Para integrar AdMob real, instale:
```bash
npm install @react-native-google-mobile-ads/react-native-google-mobile-ads
```
E adicione o App ID no `android/app/src/main/res/values/strings.xml`.

---

## ⚠️ Notas Importantes
- O **`google-services.json`** precisa ser baixado do Firebase Console e colocado em `android/app/`
- Para o Google Sign-In funcionar no APK, o SHA-1 do keystore precisa ser cadastrado no Firebase Console
