// ─── PricingScreen ────────────────────────────────────────────────────────────
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  FlatList,
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {SubscriptionPlan, GlobalConfig, UserProfile} from '../types';
import {Colors, Radius, Spacing, globalStyles} from '../theme';
import {formatCurrency} from '../utils/fortnight';

interface PricingProps {navigation: AppNavigation; profile: UserProfile | null}

export function PricingScreen({navigation, profile}: PricingProps) {
  const [config, setConfig] = useState<GlobalConfig | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
    });
    return () => unsub();
  }, []);

  if (!config) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  const currentPlan = profile?.plan || 'free';

  type PlanItem = {
    id: SubscriptionPlan;
    name: string;
    price: string;
    period: string;
    icon: string;
    iconColor: string;
    popular?: boolean;
    features: string[];
  };

  const plans: PlanItem[] = [
    {id: 'free' as SubscriptionPlan, name: 'Grátis', price: 'R$ 0', period: '', icon: 'lightning-bolt', iconColor: Colors.zinc400, features: [`Até ${config.freeModelLimit || 5} modelos`, `Até ${config.freeClientLimit || 3} clientes`, 'Controle de produção diária', 'Relatórios básicos', 'Contém anúncios']},
    {id: 'basic' as SubscriptionPlan, name: 'Basic', price: `R$ ${formatCurrency(config.basicPrice || 4.99)}`, period: '/mês', icon: 'shield-outline', iconColor: Colors.blue600, features: [`Até ${config.features?.basic?.maxModels || 12} modelos`, `Até ${config.features?.basic?.maxClients || 5} clientes`, 'Sem anúncios', 'Suporte via e-mail']},
    {id: 'premium' as SubscriptionPlan, name: 'Premium', price: `R$ ${formatCurrency(config.premiumPrice || 10.99)}`, period: '/mês', icon: 'shield-star-outline', iconColor: Colors.emerald600, popular: true, features: [`Até ${config.features?.premium?.maxModels || 30} modelos`, `Até ${config.features?.premium?.maxClients || 15} clientes`, 'Relatórios com exportação PDF', 'Sem anúncios', 'Suporte prioritário', '15 dias grátis']},
    {id: 'pro' as SubscriptionPlan, name: 'Pro', price: `R$ ${formatCurrency(config.proPrice || 19.99)}`, period: '/mês', icon: 'crown-outline', iconColor: Colors.amber500, features: ['Modelos ilimitados', 'Clientes ilimitados', 'Exportação Excel (CSV)', 'Múltiplos dispositivos', 'Suporte WhatsApp', '15 dias grátis']},
  ];

  return (
    <ScrollView style={globalStyles.container} contentContainerStyle={styles.content}>
      <Text style={styles.mainTitle}>Planos e Preços</Text>
      <Text style={styles.mainSub}>Teste os planos pagos por 15 dias sem compromisso.</Text>

      {plans.map(plan => (
        <View key={plan.id} style={[styles.planCard, plan.popular && styles.planCardPopular]}>
          {plan.popular && (
            <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>Mais Popular</Text></View>
          )}
          <View style={styles.planHeader}>
            <View style={[styles.planIcon, {backgroundColor: Colors.zinc50}]}>
              <Icon name={plan.icon} size={24} color={plan.iconColor} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                {plan.period ? <Text style={styles.planPeriod}>{plan.period}</Text> : null}
              </View>
            </View>
            {currentPlan === plan.id && (
              <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Ativo</Text></View>
            )}
          </View>
          <View style={styles.featuresList}>
            {plan.features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Icon name="check-circle" size={16} color={Colors.emerald600} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          {plan.id !== 'free' && currentPlan !== plan.id && (
            <TouchableOpacity
              style={[styles.selectPlanBtn, plan.popular && {backgroundColor: Colors.zinc900}]}
              onPress={() => navigation.navigate('Checkout', {planId: plan.id})}>
              <Text style={[styles.selectPlanText, plan.popular && {color: Colors.white}]}>
                Assinar {plan.name}
              </Text>
              <Icon name="arrow-right" size={16} color={plan.popular ? Colors.white : Colors.zinc900} />
            </TouchableOpacity>
          )}
          {plan.id !== 'free' && currentPlan === 'free' && !profile?.hasUsedTrial && (
            <TouchableOpacity
              style={styles.trialBtn}
              onPress={() => navigation.navigate('Checkout', {planId: plan.id})}>
              <Text style={styles.trialBtnText}>Testar 15 dias Grátis</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── CheckoutScreen ────────────────────────────────────────────────────────────

interface CheckoutProps {navigation: any; profile: UserProfile | null; route: any}

export function CheckoutScreen({navigation, profile, route}: CheckoutProps) {
  const planId: SubscriptionPlan = route.params?.planId;
  const [config, setConfig] = useState<GlobalConfig | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
    });
    return () => unsub();
  }, []);

  const planPrice: Record<string, number> = {
    basic: config?.basicPrice || 4.99,
    premium: config?.premiumPrice || 10.99,
    pro: config?.proPrice || 19.99,
  };

  return (
    <View style={globalStyles.container}>
      <View style={styles.checkoutHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.zinc900} />
        </TouchableOpacity>
        <Text style={styles.checkoutTitle}>Checkout — Plano {planId?.toUpperCase()}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.checkoutContent}>
        <View style={[globalStyles.card, {marginBottom: Spacing.xl}]}>
          <Text style={styles.checkoutLabel}>Plano selecionado</Text>
          <Text style={styles.checkoutPlanName}>{planId?.toUpperCase()}</Text>
          <Text style={styles.checkoutPrice}>R$ {formatCurrency(planPrice[planId] ?? 0)} / mês</Text>
          <Text style={styles.checkoutTrial}>15 dias de teste grátis. Cobrança automática após.</Text>
        </View>

        {config?.mercadopagoEnabled && (
          <View style={[globalStyles.card, styles.paymentMethodCard]}>
            <Icon name="credit-card-outline" size={28} color={Colors.zinc600} />
            <View style={{flex: 1, marginLeft: Spacing.lg}}>
              <Text style={styles.payMethodTitle}>Mercado Pago</Text>
              <Text style={styles.payMethodSub}>Cartão de crédito, débito ou PIX</Text>
            </View>
            <Icon name="chevron-right" size={20} color={Colors.zinc400} />
          </View>
        )}

        {config?.pixEnabled && (
          <View style={[globalStyles.card, styles.paymentMethodCard]}>
            <Icon name="qrcode" size={28} color={Colors.zinc600} />
            <View style={{flex: 1, marginLeft: Spacing.lg}}>
              <Text style={styles.payMethodTitle}>PIX</Text>
              <Text style={styles.payMethodSub}>Chave: {config.pixKey}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={Colors.zinc400} />
          </View>
        )}

        <View style={styles.checkoutInfo}>
          <Icon name="information-outline" size={18} color={Colors.zinc400} />
          <Text style={styles.checkoutInfoText}>
            Para assinar, entre em contato ou utilize o link de pagamento do administrador. A assinatura será ativada após confirmação do pagamento.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── AdminUsersScreen ─────────────────────────────────────────────────────────

export function AdminUsersScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const data: UserProfile[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as UserProfile));
      setUsers(data.sort((a, b) => (a.email || '').localeCompare(b.email || '')));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleBlock = async (user: UserProfile) => {
    await updateDoc(doc(db, 'users', user.id), {isBlocked: !user.isBlocked});
    Toast.show({type: 'success', text1: user.isBlocked ? 'Usuário desbloqueado!' : 'Usuário bloqueado!'});
  };

  const changePlan = async (userId: string, plan: SubscriptionPlan) => {
    await updateDoc(doc(db, 'users', userId), {plan, updatedAt: new Date().toISOString()});
    Toast.show({type: 'success', text1: 'Plano atualizado!'});
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <FlatList
      data={users}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.adminList}
      ListHeaderComponent={<Text style={styles.adminHeader}>Usuários ({users.length})</Text>}
      renderItem={({item: user}) => (
        <View style={styles.userCard}>
          <View style={styles.userCardTop}>
            <View style={{flex: 1}}>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userName}>{user.displayName || 'Sem nome'}</Text>
              <View style={styles.userBadges}>
                <View style={[styles.planBadge, user.plan === 'pro' ? styles.badgePro : user.plan === 'premium' ? styles.badgePremium : user.plan === 'basic' ? styles.badgeBasic : styles.badgeFree]}>
                  <Text style={styles.planBadgeText}>{user.plan?.toUpperCase()}</Text>
                </View>
                {user.role === 'admin' && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>ADMIN</Text></View>}
                {user.isBlocked && <View style={styles.blockedBadge}><Text style={styles.blockedBadgeText}>BLOQUEADO</Text></View>}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.blockBtn, user.isBlocked && {backgroundColor: Colors.emerald50}]}
              onPress={() => toggleBlock(user)}>
              <Icon name={user.isBlocked ? 'lock-open' : 'lock'} size={18} color={user.isBlocked ? Colors.emerald600 : Colors.red600} />
            </TouchableOpacity>
          </View>
          <View style={styles.planSelector}>
            {(['free', 'basic', 'premium', 'pro'] as SubscriptionPlan[]).map(plan => (
              <TouchableOpacity
                key={plan}
                style={[styles.planOption, user.plan === plan && styles.planOptionActive]}
                onPress={() => changePlan(user.id, plan)}>
                <Text style={[styles.planOptionText, user.plan === plan && {color: Colors.white}]}>{plan}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    />
  );
}

// ─── AdminConfigScreen ────────────────────────────────────────────────────────

export function AdminConfigScreen() {
  const [config, setConfig] = useState<Partial<GlobalConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'config', 'global'), config as any);
      Toast.show({type: 'success', text1: 'Configurações salvas!'});
    } catch (e) {
      Toast.show({type: 'error', text1: 'Erro ao salvar.'});
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  const Field = ({label, value, onChange, keyboardType = 'default'}: {label: string; value: string; onChange: (v: string) => void; keyboardType?: string}) => (
    <View style={styles.configField}>
      <Text style={globalStyles.label}>{label}</Text>
      <TextInput
        style={globalStyles.input}
        value={String(value ?? '')}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={Colors.zinc400}
      />
    </View>
  );

  return (
    <ScrollView style={globalStyles.container} contentContainerStyle={styles.configContent}>
      <Text style={styles.configSection}>Configurações Gerais</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Modo Manutenção</Text>
        <Switch value={!!config.maintenanceMode} onValueChange={v => setConfig(p => ({...p, maintenanceMode: v}))} trackColor={{false: Colors.zinc200, true: Colors.zinc900}} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>AdMob Ativo</Text>
        <Switch value={!!config.admobEnabled} onValueChange={v => setConfig(p => ({...p, admobEnabled: v}))} trackColor={{false: Colors.zinc200, true: Colors.zinc900}} />
      </View>

      <Text style={[styles.configSection, {marginTop: Spacing.xl}]}>Preços</Text>
      <Field label="Preço Basic (R$)" value={config.basicPrice} onChange={(v: string) => setConfig(p => ({...p, basicPrice: parseFloat(v) || 0}))} keyboardType="decimal-pad" />
      <Field label="Preço Premium (R$)" value={config.premiumPrice} onChange={(v: string) => setConfig(p => ({...p, premiumPrice: parseFloat(v) || 0}))} keyboardType="decimal-pad" />
      <Field label="Preço Pro (R$)" value={config.proPrice} onChange={(v: string) => setConfig(p => ({...p, proPrice: parseFloat(v) || 0}))} keyboardType="decimal-pad" />

      <Text style={[styles.configSection, {marginTop: Spacing.xl}]}>Limites do Plano Free</Text>
      <Field label="Máx. Modelos (Free)" value={config.freeModelLimit} onChange={(v: string) => setConfig(p => ({...p, freeModelLimit: parseInt(v) || 0}))} keyboardType="number-pad" />
      <Field label="Máx. Clientes (Free)" value={config.freeClientLimit} onChange={(v: string) => setConfig(p => ({...p, freeClientLimit: parseInt(v) || 0}))} keyboardType="number-pad" />

      <Text style={[styles.configSection, {marginTop: Spacing.xl}]}>Mercado Pago</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Mercado Pago Ativo</Text>
        <Switch value={!!config.mercadopagoEnabled} onValueChange={v => setConfig(p => ({...p, mercadopagoEnabled: v}))} trackColor={{false: Colors.zinc200, true: Colors.zinc900}} />
      </View>
      <Field label="Chave Pública" value={config.mercadopagoPublicKey} onChange={(v: string) => setConfig(p => ({...p, mercadopagoPublicKey: v}))} />
      <Field label="Access Token" value={config.mercadopagoAccessToken} onChange={(v: string) => setConfig(p => ({...p, mercadopagoAccessToken: v}))} />

      <Text style={[styles.configSection, {marginTop: Spacing.xl}]}>PIX</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>PIX Ativo</Text>
        <Switch value={!!config.pixEnabled} onValueChange={v => setConfig(p => ({...p, pixEnabled: v}))} trackColor={{false: Colors.zinc200, true: Colors.zinc900}} />
      </View>
      <Field label="Chave PIX" value={config.pixKey} onChange={(v: string) => setConfig(p => ({...p, pixKey: v}))} />
      <Field label="Nome (PIX)" value={config.pixName} onChange={(v: string) => setConfig(p => ({...p, pixName: v}))} />
      <Field label="Cidade (PIX)" value={config.pixCity} onChange={(v: string) => setConfig(p => ({...p, pixCity: v}))} />

      <Text style={[styles.configSection, {marginTop: Spacing.xl}]}>AdMob</Text>
      <Field label="Banner ID" value={config.admobBannerId} onChange={(v: string) => setConfig(p => ({...p, admobBannerId: v}))} />
      <Field label="Interstitial ID" value={config.admobInterstitialId} onChange={(v: string) => setConfig(p => ({...p, admobInterstitialId: v}))} />

      <TouchableOpacity style={[globalStyles.primaryButton, {marginTop: Spacing.xxl}]} onPress={saveConfig} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar Configurações</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// Types for UserProfile used in admin
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: SubscriptionPlan;
  isBlocked: boolean;
  createdAt: string;
  trialStartDate?: string | null;
  trialPlan?: SubscriptionPlan | null;
  hasUsedTrial?: boolean;
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  // Pricing
  content: {padding: Spacing.xl, paddingBottom: 40},
  mainTitle: {fontSize: 24, fontWeight: '900', color: Colors.zinc900, textAlign: 'center', marginBottom: 8},
  mainSub: {fontSize: 14, color: Colors.zinc500, textAlign: 'center', marginBottom: Spacing.xxl},
  planCard: {backgroundColor: Colors.white, borderRadius: 24, borderWidth: 1, borderColor: Colors.zinc200, padding: Spacing.xl, marginBottom: Spacing.lg},
  planCardPopular: {borderColor: Colors.zinc900, borderWidth: 2},
  popularBadge: {backgroundColor: Colors.zinc900, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'center', marginBottom: Spacing.md},
  popularBadgeText: {color: Colors.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1},
  planHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.lg},
  planIcon: {width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  planName: {fontSize: 18, fontWeight: '700', color: Colors.zinc900},
  planPriceRow: {flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2},
  planPrice: {fontSize: 20, fontWeight: '900', color: Colors.zinc900},
  planPeriod: {fontSize: 13, color: Colors.zinc500},
  activeBadge: {backgroundColor: Colors.emerald50, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4},
  activeBadgeText: {fontSize: 10, fontWeight: '700', color: Colors.emerald600, textTransform: 'uppercase'},
  featuresList: {gap: 8, marginBottom: Spacing.xl},
  featureRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  featureText: {fontSize: 13, color: Colors.zinc600},
  selectPlanBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.xl, borderWidth: 2, borderColor: Colors.zinc900},
  selectPlanText: {fontWeight: '700', fontSize: 14, color: Colors.zinc900},
  trialBtn: {alignItems: 'center', paddingVertical: 10, marginTop: 8},
  trialBtnText: {fontSize: 12, fontWeight: '700', color: Colors.emerald600, textTransform: 'uppercase', letterSpacing: 0.5},
  // Checkout
  checkoutHeader: {flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.zinc100},
  backBtn: {padding: 8, marginRight: 8},
  checkoutTitle: {fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  checkoutContent: {padding: Spacing.xl},
  checkoutLabel: {fontSize: 11, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', marginBottom: 4},
  checkoutPlanName: {fontSize: 22, fontWeight: '900', color: Colors.zinc900},
  checkoutPrice: {fontSize: 16, fontWeight: '700', color: Colors.zinc600, marginTop: 4},
  checkoutTrial: {fontSize: 12, color: Colors.zinc400, marginTop: 6, fontStyle: 'italic'},
  paymentMethodCard: {flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md},
  payMethodTitle: {fontSize: 15, fontWeight: '700', color: Colors.zinc900},
  payMethodSub: {fontSize: 12, color: Colors.zinc500},
  checkoutInfo: {flexDirection: 'row', gap: 10, backgroundColor: Colors.zinc50, borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.lg},
  checkoutInfoText: {flex: 1, fontSize: 13, color: Colors.zinc600, lineHeight: 20},
  // Admin Users
  adminList: {padding: Spacing.xl, paddingBottom: 40},
  adminHeader: {fontSize: 18, fontWeight: '700', color: Colors.zinc900, marginBottom: Spacing.xl},
  userCard: {backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: 12, borderWidth: 1, borderColor: Colors.zinc100},
  userCardTop: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.lg},
  userEmail: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  userName: {fontSize: 12, color: Colors.zinc500, marginTop: 2},
  userBadges: {flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap'},
  planBadge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full},
  badgeFree: {backgroundColor: Colors.zinc100},
  badgeBasic: {backgroundColor: Colors.blue50},
  badgePremium: {backgroundColor: Colors.emerald50},
  badgePro: {backgroundColor: Colors.amber50},
  planBadgeText: {fontSize: 10, fontWeight: '700', color: Colors.zinc600},
  adminBadge: {backgroundColor: '#f3e8ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full},
  adminBadgeText: {fontSize: 10, fontWeight: '700', color: '#7e22ce'},
  blockedBadge: {backgroundColor: Colors.red50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full},
  blockedBadgeText: {fontSize: 10, fontWeight: '700', color: Colors.red600},
  blockBtn: {padding: 8, backgroundColor: Colors.red50, borderRadius: Radius.lg},
  planSelector: {flexDirection: 'row', gap: 6},
  planOption: {flex: 1, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.zinc200, alignItems: 'center'},
  planOptionActive: {backgroundColor: Colors.zinc900, borderColor: Colors.zinc900},
  planOptionText: {fontSize: 11, fontWeight: '700', color: Colors.zinc500, textTransform: 'uppercase'},
  // Admin Config
  configContent: {padding: Spacing.xl, paddingBottom: 60},
  configSection: {fontSize: 16, fontWeight: '700', color: Colors.zinc900, marginBottom: Spacing.lg},
  toggleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.zinc100},
  toggleLabel: {fontSize: 14, fontWeight: '600', color: Colors.zinc700},
  configField: {marginBottom: Spacing.md},
});
