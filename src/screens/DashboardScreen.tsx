import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {format, differenceInDays} from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {DailySheet, Fortnight, UserProfile, GlobalConfig} from '../types';
import {getFortnightInfo, formatCurrency} from '../utils/fortnight';
import {Colors, Radius, Spacing, globalStyles} from '../theme';
import {AdBanner} from '../components/AdMob';

interface Props {
  navigation: AppNavigation;
  profile: UserProfile | null;
}

export function DashboardScreen({navigation, profile}: Props) {
  const [todayStats, setTodayStats] = useState({pairs: 0, value: 0});
  const [fortnightStats, setFortnightStats] = useState<Fortnight | null>(null);
  const [recentSheets, setRecentSheets] = useState<DailySheet[]>([]);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const trialDaysRemaining = profile?.trialStartDate
    ? 15 - differenceInDays(new Date(), new Date(profile.trialStartDate))
    : 0;

  useEffect(() => {
    if (!auth.currentUser) return;
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const fInfo = getFortnightInfo(now);

    const unsubConfig = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
    });

    const unsubToday = onSnapshot(
      query(
        collection(db, 'daily_sheets'),
        where('userId', '==', auth.currentUser!.uid),
        where('date', '==', today),
      ),
      snap => {
        let pairs = 0, value = 0;
        snap.forEach(d => {
          pairs += d.data().totalPairs || 0;
          value += d.data().totalValue || 0;
        });
        setTodayStats({pairs, value});
      },
    );

    const unsubFortnight = onSnapshot(
      query(
        collection(db, 'fortnights'),
        where('userId', '==', auth.currentUser!.uid),
        where('year', '==', fInfo.year),
        where('month', '==', fInfo.month),
        where('period', '==', fInfo.period),
      ),
      snap => {
        if (!snap.empty) {
          const agg: Fortnight = {
            id: 'agg',
            userId: auth.currentUser!.uid,
            clientId: 'all',
            year: fInfo.year,
            month: fInfo.month,
            period: fInfo.period as 1 | 2,
            totalPairs: 0,
            totalValue: 0,
            paidValue: 0,
            status: 'not_paid',
          };
          snap.forEach(d => {
            const data = d.data() as Fortnight;
            agg.totalPairs += data.totalPairs || 0;
            agg.totalValue += data.totalValue || 0;
            agg.paidValue += data.paidValue || 0;
          });
          if (agg.paidValue >= agg.totalValue && agg.totalValue > 0)
            agg.status = 'paid';
          else if (agg.paidValue > 0) agg.status = 'partially_paid';
          setFortnightStats(agg);
        } else {
          setFortnightStats(null);
        }
      },
    );

    const unsubRecent = onSnapshot(
      query(
        collection(db, 'daily_sheets'),
        where('userId', '==', auth.currentUser!.uid),
        orderBy('date', 'desc'),
        limit(5),
      ),
      snap => {
        const sheets: DailySheet[] = [];
        snap.forEach(d => sheets.push({id: d.id, ...d.data()} as DailySheet));
        setRecentSheets(sheets);
        setLoading(false);
      },
    );

    return () => {
      unsubConfig();
      unsubToday();
      unsubFortnight();
      unsubRecent();
    };
  }, []);

  const handleCancelTrial = () => {
    Alert.alert(
      'Cancelar Período de Teste',
      'Deseja realmente cancelar? Você retornará ao plano Free imediatamente.',
      [
        {text: 'Não', style: 'cancel'},
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            if (!auth.currentUser) return;
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              trialStartDate: null,
              trialPlan: null,
              plan: 'free',
              subscriptionId: null,
              updatedAt: new Date().toISOString(),
            });
          },
        },
      ],
    );
  };

  if (config?.maintenanceMode && auth.currentUser?.email !== 'bitcoinc3@gmail.com') {
    return (
      <View style={styles.maintenanceBox}>
        <Icon name="tools" size={48} color={Colors.amber500} />
        <Text style={styles.maintenanceTitle}>Sistema em Manutenção</Text>
        <Text style={styles.maintenanceSub}>Estamos realizando melhorias. Voltamos em breve!</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.zinc900} />
      </View>
    );
  }

  const pending = (fortnightStats?.totalValue || 0) - (fortnightStats?.paidValue || 0);

  return (
    <ScrollView style={globalStyles.container} contentContainerStyle={styles.content}>
      {/* Trial Banner */}
      {profile?.trialStartDate && (
        <View style={styles.trialBanner}>
          <View style={styles.trialIconBox}>
            <Icon name="lightning-bolt" size={24} color={Colors.white} />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.trialTitle}>
              Teste Ativo: Plano {profile.trialPlan}
            </Text>
            <Text style={styles.trialSub}>
              {trialDaysRemaining} dias restantes. Assinatura ativada automaticamente após.
            </Text>
          </View>
          <TouchableOpacity onPress={handleCancelTrial} style={styles.trialCancelBtn}>
            <Text style={styles.trialCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AdMob Banner */}
      <AdBanner profile={profile} />

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, {flex: 1}]}>
          <View style={[styles.statIcon, {backgroundColor: Colors.blue50}]}>
            <Icon name="package-variant" size={22} color={Colors.blue600} />
          </View>
          <Text style={styles.statLabel}>Hoje</Text>
          <Text style={styles.statValue}>{todayStats.pairs} pares</Text>
          <Text style={styles.statSub}>
            R$ {formatCurrency(todayStats.value)}
          </Text>
        </View>

        <View style={[styles.statCard, {flex: 1}]}>
          <View style={[styles.statIcon, {backgroundColor: Colors.emerald50}]}>
            <Icon name="trending-up" size={22} color={Colors.emerald600} />
          </View>
          <Text style={styles.statLabel}>Quinzena</Text>
          <Text style={styles.statValue}>{fortnightStats?.totalPairs || 0} pares</Text>
          <Text style={styles.statSub}>
            R$ {formatCurrency(fortnightStats?.totalValue || 0)}
          </Text>
        </View>

        <View style={[styles.statCard, {flex: 1}]}>
          <View style={[styles.statIcon, {backgroundColor: Colors.amber50}]}>
            <Icon name="currency-usd" size={22} color={Colors.amber600} />
          </View>
          <Text style={styles.statLabel}>A Receber</Text>
          <Text style={[styles.statValue, {fontSize: 14}]}>
            R$ {formatCurrency(pending)}
          </Text>
          <Text style={styles.statSub}>
            {fortnightStats?.status === 'paid' ? 'Paga' : fortnightStats?.status === 'partially_paid' ? 'Parcial' : 'Pendente'}
          </Text>
        </View>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Atalhos</Text>
      <View style={styles.quickGrid}>
        {[
          {icon: 'plus-circle', label: 'Nova Ficha', sub: 'Lançar produção', screen: 'DailySheetForm', dark: true},
          {icon: 'shoe-sneaker', label: 'Modelos', sub: 'Ver catálogo', screen: 'Models'},
          {icon: 'currency-usd', label: 'Financeiro', sub: 'Quinzenas', screen: 'ClientFinance'},
          {icon: 'chart-bar', label: 'Relatórios', sub: 'Exportar dados', screen: 'Reports'},
        ].map(item => (
          <TouchableOpacity
            key={item.screen}
            style={[styles.quickCard, item.dark && styles.quickCardDark]}
            onPress={() => navigation.navigate(item.screen)}>
            <View style={[styles.quickIcon, item.dark && styles.quickIconDark]}>
              <Icon name={item.icon} size={20} color={item.dark ? Colors.white : Colors.zinc600} />
            </View>
            <Text style={[styles.quickLabel, item.dark && {color: Colors.white}]}>{item.label}</Text>
            <Text style={[styles.quickSub, item.dark && {color: 'rgba(255,255,255,0.6)'}]}>{item.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent sheets */}
      <Text style={styles.sectionTitle}>Últimos Lançamentos</Text>
      <View style={globalStyles.card}>
        {recentSheets.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum lançamento recente.</Text>
        ) : (
          recentSheets.map((sheet, i) => (
            <TouchableOpacity
              key={sheet.id}
              style={[styles.sheetRow, i > 0 && {borderTopWidth: 1, borderTopColor: Colors.zinc100}]}
              onPress={() => navigation.navigate('DailySheetForm', {sheetId: sheet.id})}>
              <View style={styles.sheetIconBox}>
                <Icon name="clock-outline" size={18} color={Colors.zinc500} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.sheetDate}>
                  {format(new Date(sheet.date + 'T12:00:00'), 'dd/MM/yyyy')}
                </Text>
                <Text style={styles.sheetSub}>{sheet.totalPairs} pares</Text>
              </View>
              <Text style={styles.sheetValue}>
                R$ {formatCurrency(sheet.totalValue)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: Spacing.xl, paddingBottom: 40},
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  maintenanceBox: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  maintenanceTitle: {fontSize: 22, fontWeight: '700', color: Colors.zinc900, marginTop: 16},
  maintenanceSub: {fontSize: 14, color: Colors.zinc500, marginTop: 8, textAlign: 'center'},
  trialBanner: {
    backgroundColor: Colors.emerald600,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  trialIconBox: {width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center'},
  trialTitle: {color: Colors.white, fontWeight: '700', fontSize: 14},
  trialSub: {color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2},
  trialCancelBtn: {backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 6},
  trialCancelText: {color: Colors.emerald600, fontWeight: '700', fontSize: 12},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: Spacing.xl},
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.zinc100,
  },
  statIcon: {width: 40, height: 40, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: 10},
  statLabel: {fontSize: 11, color: Colors.zinc500, fontWeight: '600'},
  statValue: {fontSize: 16, fontWeight: '700', color: Colors.zinc900, marginTop: 2},
  statSub: {fontSize: 11, color: Colors.zinc400, marginTop: 2},
  sectionTitle: {fontSize: 16, fontWeight: '700', color: Colors.zinc900, marginBottom: Spacing.md},
  quickGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.xl},
  quickCard: {
    width: '47%',
    backgroundColor: Colors.zinc50,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
  },
  quickCardDark: {backgroundColor: Colors.zinc900},
  quickIcon: {width: 36, height: 36, backgroundColor: Colors.white, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2},
  quickIconDark: {backgroundColor: 'rgba(255,255,255,0.1)'},
  quickLabel: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  quickSub: {fontSize: 11, color: Colors.zinc500, marginTop: 2},
  sheetRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12},
  sheetIconBox: {width: 40, height: 40, backgroundColor: Colors.zinc100, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center'},
  sheetDate: {fontSize: 14, fontWeight: '600', color: Colors.zinc900},
  sheetSub: {fontSize: 12, color: Colors.zinc500, marginTop: 2},
  sheetValue: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  emptyText: {textAlign: 'center', color: Colors.zinc400, paddingVertical: 24},
});
