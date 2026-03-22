import React, {useState, useEffect} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Modal, Image,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {doc, onSnapshot} from 'firebase/firestore';
import {db, auth} from '../firebase';
import {GlobalConfig, SubscriptionPlan, UserProfile, AppNavigation} from '../types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import {Colors, Radius, Spacing, globalStyles} from '../theme';
import {formatCurrency} from '../utils/fortnight';

const FUNCTIONS_BASE =
  'https://us-central1-ai-studio-applet-webapp-91ce3.cloudfunctions.net';

const API = {
  mpCreateSubscription: `${FUNCTIONS_BASE}/mpCreateSubscription`,
  mpCancelSubscription: `${FUNCTIONS_BASE}/mpCancelSubscription`,
  mpActivatePlan:       `${FUNCTIONS_BASE}/mpActivatePlan`,
  pagseguroCheckout:    `${FUNCTIONS_BASE}/pagseguroCreateCheckout`,
  pixCreateCharge:      `${FUNCTIONS_BASE}/pixCreateCharge`,
  pixCheckStatus:       `${FUNCTIONS_BASE}/pixCheckStatus`,
};

type PaymentMethod = 'mercadopago' | 'pagseguro' | 'pix';

interface Props {
  navigation: AppNavigation;
  profile: UserProfile | null;
  route: {params: {planId?: string}};
}

export function CheckoutScreen({navigation, profile, route}: Props) {
  const planId: SubscriptionPlan = route.params?.planId;
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercadopago');
  const [pixModal, setPixModal] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixTxid, setPixTxid] = useState('');
  const [pixPolling, setPixPolling] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) {
        const data = d.data() as GlobalConfig;
        setConfig(data);
        if (data.mercadopagoEnabled) setPaymentMethod('mercadopago');
        else if (data.pagseguroEnabled) setPaymentMethod('pagseguro');
        else if (data.pixEnabled) setPaymentMethod('pix');
      }
    });
    return () => unsub();
  }, []);

  // Deep link — retorno do MP/PagSeguro após pagamento no browser
  useEffect(() => {
    const handleDeepLink = async ({url}: {url: string}) => {
      if (!url.includes('payment/success')) return;
      try {
        const cleaned = url.replace('controlecorte://', 'https://app/');
        const urlObj = new URL(cleaned);
        const returnedPlan = urlObj.searchParams.get('plan');
        const returnedUserId = urlObj.searchParams.get('userId');
        if (!returnedPlan || !returnedUserId) return;

        const resp = await fetch(API.mpActivatePlan, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: returnedUserId, planId: returnedPlan}),
        });
        if (!resp.ok) throw new Error('Falha ao ativar plano.');
        Toast.show({type: 'success', text1: '🎉 Plano ativado!', text2: `Bem-vindo ao plano ${returnedPlan.toUpperCase()}!`});
        navigation.navigate('Main');
      } catch (e: any) {
        Toast.show({type: 'error', text1: 'Erro ao ativar plano.', text2: e.message});
      }
    };
    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, [navigation]);

  // PIX polling — checa a cada 5s
  useEffect(() => {
    if (!pixPolling || !pixTxid) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${API.pixCheckStatus}?txid=${pixTxid}&userId=${uid}`);
        const data = await resp.json();
        if (data.status === 'paid') {
          setPixPolling(false);
          setPixModal(false);
          Toast.show({type: 'success', text1: '✅ PIX confirmado!', text2: `Plano ${data.planId?.toUpperCase()} ativado.`});
          navigation.navigate('Main');
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [pixPolling, pixTxid, navigation]);

  const planPrice: Record<string, number> = {
    basic: config?.basicPrice || 4.99,
    premium: config?.premiumPrice || 10.99,
    pro: config?.proPrice || 19.99,
  };
  const planLabel: Record<string, string> = {basic: 'Basic', premium: 'Premium', pro: 'Pro'};

  const handleCheckout = async () => {
    if (!auth.currentUser || !config) return;
    setLoading(true);
    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email || '';
    const price = planPrice[planId];
    const name = planLabel[planId];
    try {
      if (paymentMethod === 'mercadopago') {
        const resp = await fetch(API.mpCreateSubscription, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({planId, planName: name, price, userEmail: email, userId: uid}),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erro Mercado Pago.');
        await Linking.openURL(data.checkoutUrl);
      } else if (paymentMethod === 'pagseguro') {
        const resp = await fetch(API.pagseguroCheckout, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({planId, planName: name, price, userEmail: email, userId: uid}),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erro PagSeguro.');
        await Linking.openURL(data.checkoutUrl);
      } else if (paymentMethod === 'pix') {
        const resp = await fetch(API.pixCreateCharge, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({price, userId: uid, planId}),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erro ao gerar PIX.');
        setPixPayload(data.pixCopiaECola || '');
        setPixQrUrl(data.qrCodeImageUrl || '');
        setPixTxid(data.txid);
        setPixModal(true);
        setPixPolling(true);
      }
    } catch (err: any) {
      Toast.show({type: 'error', text1: 'Erro no checkout', text2: err.message});
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!auth.currentUser || !profile?.subscriptionId) return;
    Alert.alert(
      'Cancelar Assinatura',
      'Você perderá acesso aos recursos pagos imediatamente. Confirmar?',
      [
        {text: 'Não', style: 'cancel'},
        {text: 'Cancelar Assinatura', style: 'destructive', onPress: async () => {
          try {
            const resp = await fetch(API.mpCancelSubscription, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({userId: auth.currentUser!.uid, subscriptionId: profile.subscriptionId}),
            });
            if (!resp.ok) throw new Error('Erro ao cancelar.');
            Toast.show({type: 'success', text1: 'Assinatura cancelada.'});
            navigation.goBack();
          } catch (err: any) {
            Toast.show({type: 'error', text1: err.message});
          }
        }},
      ],
    );
  };

  if (!config) return <View style={s.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  const hasAny = config.mercadopagoEnabled || config.pagseguroEnabled || config.pixEnabled;

  return (
    <View style={globalStyles.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.zinc900} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout — Plano {planLabel[planId]}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Plan card */}
        <View style={[globalStyles.card, s.planCard]}>
          <View style={s.planRow}>
            <Icon name="crown-outline" size={28} color={Colors.amber500} />
            <View style={{flex: 1}}>
              <Text style={s.planLabel}>Plano Selecionado</Text>
              <Text style={s.planName}>{planLabel[planId]?.toUpperCase()}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={s.planPrice}>R$ {formatCurrency(planPrice[planId] ?? 0)}</Text>
              <Text style={s.planPer}>/mês</Text>
            </View>
          </View>
          <View style={s.trialRow}>
            <Icon name="gift-outline" size={15} color={Colors.emerald600} />
            <Text style={s.trialText}>15 dias de teste grátis. Cobrança automática após.</Text>
          </View>
        </View>

        {hasAny ? (
          <>
            <Text style={s.sectionTitle}>Forma de Pagamento</Text>

            {config.mercadopagoEnabled && (
              <TouchableOpacity style={[s.method, paymentMethod === 'mercadopago' && s.methodActive]} onPress={() => setPaymentMethod('mercadopago')}>
                <Icon name="credit-card-outline" size={24} color={paymentMethod === 'mercadopago' ? Colors.white : Colors.zinc600} />
                <View style={{flex: 1}}>
                  <Text style={[s.methodTitle, paymentMethod === 'mercadopago' && {color: Colors.white}]}>Mercado Pago</Text>
                  <Text style={[s.methodSub, paymentMethod === 'mercadopago' && {color: 'rgba(255,255,255,0.65)'}]}>Cartão, débito ou PIX</Text>
                </View>
                <View style={[s.radio, paymentMethod === 'mercadopago' && s.radioOn]}>
                  {paymentMethod === 'mercadopago' && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            )}

            {config.pagseguroEnabled && (
              <TouchableOpacity style={[s.method, paymentMethod === 'pagseguro' && s.methodActive]} onPress={() => setPaymentMethod('pagseguro')}>
                <Icon name="shield-check-outline" size={24} color={paymentMethod === 'pagseguro' ? Colors.white : Colors.zinc600} />
                <View style={{flex: 1}}>
                  <Text style={[s.methodTitle, paymentMethod === 'pagseguro' && {color: Colors.white}]}>PagSeguro</Text>
                  <Text style={[s.methodSub, paymentMethod === 'pagseguro' && {color: 'rgba(255,255,255,0.65)'}]}>Cartão, boleto ou PIX</Text>
                </View>
                <View style={[s.radio, paymentMethod === 'pagseguro' && s.radioOn]}>
                  {paymentMethod === 'pagseguro' && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            )}

            {config.pixEnabled && (
              <TouchableOpacity style={[s.method, paymentMethod === 'pix' && s.methodActive]} onPress={() => setPaymentMethod('pix')}>
                <Icon name="qrcode" size={24} color={paymentMethod === 'pix' ? Colors.white : Colors.zinc600} />
                <View style={{flex: 1}}>
                  <Text style={[s.methodTitle, paymentMethod === 'pix' && {color: Colors.white}]}>PIX</Text>
                  <Text style={[s.methodSub, paymentMethod === 'pix' && {color: 'rgba(255,255,255,0.65)'}]}>Aprovação instantânea · {config.pixKey}</Text>
                </View>
                <View style={[s.radio, paymentMethod === 'pix' && s.radioOn]}>
                  {paymentMethod === 'pix' && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[s.cta, loading && {opacity: 0.6}]} onPress={handleCheckout} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : (
                <>
                  <Icon name={paymentMethod === 'pix' ? 'qrcode-scan' : 'lock-outline'} size={20} color={Colors.white} />
                  <Text style={s.ctaText}>{paymentMethod === 'pix' ? 'Gerar QR Code PIX' : 'Pagar com Segurança'}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={s.noPayment}>
            <Icon name="alert-circle-outline" size={32} color={Colors.amber500} />
            <Text style={s.noPaymentText}>Nenhum método de pagamento configurado. Configure no painel Admin.</Text>
          </View>
        )}

        {profile?.subscriptionId && (
          <TouchableOpacity style={s.cancelLink} onPress={handleCancelSubscription}>
            <Text style={s.cancelLinkText}>Cancelar assinatura atual</Text>
          </TouchableOpacity>
        )}

        <Text style={s.disclaimer}>🔒 Pagamento seguro. Dados financeiros não são armazenados.</Text>
      </ScrollView>

      {/* PIX Modal */}
      <Modal visible={pixModal} animationType="slide" transparent onRequestClose={() => {setPixModal(false); setPixPolling(false);}}>
        <View style={s.pixOverlay}>
          <View style={s.pixSheet}>
            <View style={s.pixHead}>
              <Text style={s.pixTitle}>Pagar com PIX</Text>
              <TouchableOpacity onPress={() => {setPixModal(false); setPixPolling(false);}}>
                <Icon name="close" size={24} color={Colors.zinc600} />
              </TouchableOpacity>
            </View>
            <Text style={s.pixInstructions}>Escaneie o QR Code ou copie o código. O plano será ativado automaticamente após o pagamento.</Text>
            {pixQrUrl ? (
              <Image source={{uri: pixQrUrl}} style={s.qrImg} resizeMode="contain" />
            ) : (
              <View style={s.qrPlaceholder}><Icon name="qrcode" size={80} color={Colors.zinc300} /></View>
            )}
            <TouchableOpacity style={s.copyBtn} onPress={() => { Clipboard.setString(pixPayload); Toast.show({type: 'success', text1: 'Código PIX copiado!'}); }}>
              <Icon name="content-copy" size={18} color={Colors.zinc900} />
              <Text style={s.copyBtnText}>Copiar Código PIX</Text>
            </TouchableOpacity>
            <View style={s.pollingRow}>
              <ActivityIndicator size="small" color={Colors.emerald600} animating={pixPolling} />
              <Text style={s.pollingText}>{pixPolling ? 'Aguardando confirmação do pagamento...' : 'Verificação encerrada.'}</Text>
            </View>
            <Text style={s.pixExpiry}>Código válido por 60 minutos.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.zinc100},
  backBtn: {padding: 8, marginRight: 8},
  headerTitle: {fontSize: 17, fontWeight: '700', color: Colors.zinc900, flex: 1},
  content: {padding: Spacing.xl, paddingBottom: 40},
  planCard: {marginBottom: Spacing.xxl},
  planRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md},
  planLabel: {fontSize: 11, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase'},
  planName: {fontSize: 20, fontWeight: '900', color: Colors.zinc900},
  planPrice: {fontSize: 22, fontWeight: '900', color: Colors.zinc900},
  planPer: {fontSize: 12, color: Colors.zinc400},
  trialRow: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.emerald50, borderRadius: Radius.xl, padding: 10},
  trialText: {flex: 1, fontSize: 12, color: Colors.emerald600, fontWeight: '600'},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: Colors.zinc900, marginBottom: Spacing.md},
  method: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.xl, borderRadius: Radius.xxl, borderWidth: 1.5, borderColor: Colors.zinc200, backgroundColor: Colors.white, marginBottom: 10},
  methodActive: {backgroundColor: Colors.zinc900, borderColor: Colors.zinc900},
  methodTitle: {fontSize: 15, fontWeight: '700', color: Colors.zinc900},
  methodSub: {fontSize: 12, color: Colors.zinc500, marginTop: 2},
  radio: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.zinc300, alignItems: 'center', justifyContent: 'center'},
  radioOn: {borderColor: Colors.white},
  radioDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white},
  cta: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.zinc900, borderRadius: Radius.xxl, paddingVertical: 18, marginTop: Spacing.xl},
  ctaText: {fontSize: 16, fontWeight: '700', color: Colors.white},
  noPayment: {backgroundColor: Colors.amber50, borderRadius: Radius.xxl, padding: Spacing.xl, alignItems: 'center', gap: 10},
  noPaymentText: {fontSize: 13, color: Colors.amber700, textAlign: 'center', lineHeight: 20},
  cancelLink: {alignItems: 'center', marginTop: Spacing.xl, padding: Spacing.lg},
  cancelLinkText: {fontSize: 13, color: Colors.red600, fontWeight: '600'},
  disclaimer: {textAlign: 'center', fontSize: 11, color: Colors.zinc400, marginTop: Spacing.xl, lineHeight: 18},
  pixOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  pixSheet: {backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xxl, paddingBottom: 40},
  pixHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg},
  pixTitle: {fontSize: 20, fontWeight: '700', color: Colors.zinc900},
  pixInstructions: {fontSize: 13, color: Colors.zinc600, lineHeight: 20, marginBottom: Spacing.xl},
  qrImg: {width: 220, height: 220, alignSelf: 'center', marginBottom: Spacing.xl},
  qrPlaceholder: {width: 220, height: 220, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.zinc50, borderRadius: Radius.xl, marginBottom: Spacing.xl},
  copyBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.zinc100, borderRadius: Radius.xl, paddingVertical: 14, marginBottom: Spacing.lg},
  copyBtnText: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  pollingRow: {flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 6},
  pollingText: {fontSize: 12, color: Colors.zinc500},
  pixExpiry: {textAlign: 'center', fontSize: 11, color: Colors.zinc400},
});
