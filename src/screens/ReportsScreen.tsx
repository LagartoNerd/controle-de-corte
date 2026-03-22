import React, {useState, useEffect} from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Share} from 'react-native';
import {collection, query, where, onSnapshot, orderBy, doc} from 'firebase/firestore';
import {BarChart} from 'react-native-chart-kit';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {Fortnight, UserProfile, GlobalConfig} from '../types';
import {formatFortnight, formatCurrency} from '../utils/fortnight';
import {Colors, Radius, Spacing, globalStyles} from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {profile: UserProfile | null}

export function ReportsScreen({profile}: Props) {
  const [fortnights, setFortnights] = useState<Fortnight[]>([]);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(
      query(collection(db, 'fortnights'), where('userId', '==', auth.currentUser.uid), orderBy('year', 'desc'), orderBy('month', 'desc'), orderBy('period', 'desc')),
      snap => {
        const data: Fortnight[] = [];
        snap.forEach(d => data.push({id: d.id, ...d.data()} as Fortnight));
        setFortnights(data);
        setLoading(false);
      },
    );
    const unsubConfig = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
    });
    return () => {unsub(); unsubConfig();};
  }, []);

  const canExport = (type: 'pdf' | 'excel') => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    const effectivePlan = profile.trialStartDate ? profile.trialPlan : profile.plan;
    if (!effectivePlan || effectivePlan === 'free') return false;
    const features = config?.features?.[effectivePlan as keyof typeof config.features];
    return type === 'pdf' ? features?.pdfExport === true : features?.excelExport === true;
  };

  const handleExportPDF = async () => {
    if (!canExport('pdf')) {
      Toast.show({type: 'error', text1: 'Exportação PDF disponível nos planos pagos.'});
      return;
    }
    const content = fortnights.map(f =>
      `${formatFortnight(f.year, f.month, f.period)} | ${f.clientName || '-'} | ${f.totalPairs} pares | R$ ${f.totalValue.toFixed(2)} | Pago: R$ ${f.paidValue.toFixed(2)}`
    ).join('\n');
    await Share.share({title: 'Relatório Controle de Corte', message: content});
  };

  const handleExportCSV = async () => {
    if (!canExport('excel')) {
      Toast.show({type: 'error', text1: 'Exportação Excel disponível no plano Pro.'});
      return;
    }
    const header = 'Período,Cliente,Pares,Valor Total,Pago,Pendente,Status\n';
    const rows = fortnights.map(f =>
      `"${formatFortnight(f.year, f.month, f.period)}","${f.clientName || ''}",${f.totalPairs},${f.totalValue.toFixed(2)},${f.paidValue.toFixed(2)},${(f.totalValue - f.paidValue).toFixed(2)},${f.status}`
    ).join('\n');
    await Share.share({title: 'Relatório CSV', message: header + rows});
  };

  // Last 6 fortnights for chart
  const chartData = [...fortnights].reverse().slice(-6);
  const chartLabels = chartData.map(f => `${f.period}Q/${f.month}`);
  const chartValues = chartData.map(f => f.totalValue);
  const chartPaid = chartData.map(f => f.paidValue);

  const statusLabel = (s: string) => s === 'paid' ? 'Paga' : s === 'partially_paid' ? 'Parcial' : 'Pendente';
  const statusStyle = (s: string) => s === 'paid' ? styles.badgePaid : s === 'partially_paid' ? styles.badgePartial : styles.badgePending;

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <ScrollView style={globalStyles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={globalStyles.title}>Relatórios</Text>
          <Text style={globalStyles.subtitle}>Análise de desempenho e exportação.</Text>
        </View>
        <View style={styles.exportBtns}>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Icon name="file-pdf-box" size={20} color={Colors.red600} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, {backgroundColor: Colors.zinc900}]} onPress={handleExportCSV}>
            <Icon name="file-excel-box" size={20} color={Colors.white} />
            <Text style={[styles.exportBtnText, {color: Colors.white}]}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        {[
          {label: 'Total Histórico', value: `R$ ${formatCurrency(fortnights.reduce((a, f) => a + f.totalValue, 0))}`, bg: Colors.zinc50, color: Colors.zinc900},
          {label: 'Total Recebido', value: `R$ ${formatCurrency(fortnights.reduce((a, f) => a + f.paidValue, 0))}`, bg: Colors.emerald50, color: Colors.emerald600},
          {label: 'Total Pendente', value: `R$ ${formatCurrency(fortnights.reduce((a, f) => a + (f.totalValue - f.paidValue), 0))}`, bg: Colors.red50, color: Colors.red600},
        ].map(card => (
          <View key={card.label} style={[styles.summaryCard, {backgroundColor: card.bg}]}>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text style={[styles.summaryValue, {color: card.color}]}>{card.value}</Text>
          </View>
        ))}
      </View>

      {/* Chart */}
      {chartData.length > 0 && (
        <View style={[globalStyles.card, {marginBottom: Spacing.xl}]}>
          <Text style={styles.sectionTitle}>Produção vs Pagamentos (6 últimas quinzenas)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={{
                labels: chartLabels,
                datasets: [
                  {data: chartValues, color: () => Colors.zinc900},
                  {data: chartPaid, color: () => Colors.emerald600},
                ],
                legend: ['Total Produzido', 'Total Pago'],
              }}
              width={Math.max(SCREEN_WIDTH - 48, chartData.length * 80)}
              height={220}
              yAxisLabel="R$"
              yAxisSuffix=""
              chartConfig={{
                backgroundGradientFrom: Colors.white,
                backgroundGradientTo: Colors.white,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(24, 24, 27, ${opacity})`,
                labelColor: () => Colors.zinc500,
                barPercentage: 0.5,
              }}
              style={{borderRadius: Radius.xl}}
              showLegend
            />
          </ScrollView>
        </View>
      )}

      {/* Table */}
      <Text style={styles.sectionTitle}>Detalhamento por Período</Text>
      {fortnights.map(f => (
        <View key={f.id} style={styles.tableRow}>
          <View style={{flex: 1}}>
            <Text style={styles.tableTitle}>{formatFortnight(f.year, f.month, f.period)}</Text>
            <Text style={styles.tableClient}>{f.clientName || 'Cliente'}</Text>
            <Text style={styles.tablePairs}>{f.totalPairs} pares</Text>
          </View>
          <View style={{alignItems: 'flex-end', gap: 4}}>
            <Text style={styles.tableTotal}>R$ {formatCurrency(f.totalValue)}</Text>
            <Text style={styles.tablePaid}>Pago: R$ {formatCurrency(f.paidValue)}</Text>
            <View style={[styles.statusBadge, statusStyle(f.status)]}>
              <Text style={styles.statusBadgeText}>{statusLabel(f.status)}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  content: {padding: Spacing.xl, paddingBottom: 40},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl},
  exportBtns: {flexDirection: 'row', gap: 8},
  exportBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.white, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.zinc200},
  exportBtnText: {fontSize: 13, fontWeight: '700', color: Colors.zinc700},
  summaryRow: {flexDirection: 'row', gap: 8, marginBottom: Spacing.xl},
  summaryCard: {flex: 1, borderRadius: Radius.xxl, padding: Spacing.md},
  summaryLabel: {fontSize: 10, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', marginBottom: 4},
  summaryValue: {fontSize: 13, fontWeight: '900'},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: Colors.zinc900, marginBottom: Spacing.md},
  tableRow: {flexDirection: 'row', backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.zinc100},
  tableTitle: {fontSize: 13, fontWeight: '700', color: Colors.zinc900},
  tableClient: {fontSize: 11, color: Colors.zinc500, marginTop: 2},
  tablePairs: {fontSize: 11, color: Colors.zinc400},
  tableTotal: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  tablePaid: {fontSize: 12, color: Colors.emerald600},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full},
  statusBadgeText: {fontSize: 10, fontWeight: '700', color: Colors.zinc600},
  badgePaid: {backgroundColor: Colors.emerald50},
  badgePartial: {backgroundColor: Colors.amber50},
  badgePending: {backgroundColor: Colors.red50},
});
