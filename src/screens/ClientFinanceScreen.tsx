import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView, Modal} from 'react-native';
import {collection, query, where, onSnapshot, orderBy, doc, writeBatch, increment}} from 'firebase/firestore';
import {format} from 'date-fns';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {db, auth} from '../firebase';
import {Client, Fortnight, Payment, DailySheet, UserProfile, AppNavigation} from '../types';
import {formatFortnight, formatCurrency} from '../utils/fortnight';
import {handleFirestoreError, OperationType} from '../utils/error';
import {ConfirmModal} from '../components/ConfirmModal';
import {Colors, Radius, Spacing, globalStyles} from '../theme';

// ─── ClientFinanceScreen ─────────────────────────────────────────────────────

interface ClientFinanceProps {navigation: AppNavigation; profile: UserProfile | null}

interface ClientSummary {
  client: Client;
  totalProduced: number;
  totalValue: number;
  paidValue: number;
  pendingValue: number;
  fortnights: Fortnight[];
}

export function ClientFinanceScreen({navigation, profile}: ClientFinanceProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [fortnights, setFortnights] = useState<Fortnight[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'clients'|'fortnights'>('clients');

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const unsubClients = onSnapshot(query(collection(db, 'clients'), where('userId', '==', uid), orderBy('name')), snap => {
      const data: Client[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as Client));
      setClients(data);
    });
    const unsubFortnights = onSnapshot(query(collection(db, 'fortnights'), where('userId', '==', uid), orderBy('year', 'desc'), orderBy('month', 'desc'), orderBy('period', 'desc')), snap => {
      const data: Fortnight[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as Fortnight));
      setFortnights(data);
      setLoading(false);
    });
    return () => {unsubClients(); unsubFortnights();};
  }, []);

  const summaries: ClientSummary[] = clients.map(client => {
    const cF = fortnights.filter(f => f.clientId === client.id);
    const totalValue = cF.reduce((a, f) => a + (f.totalValue || 0), 0);
    const paidValue = cF.reduce((a, f) => a + (f.paidValue || 0), 0);
    return {client, totalProduced: cF.reduce((a, f) => a + (f.totalPairs || 0), 0), totalValue, paidValue, pendingValue: totalValue - paidValue, fortnights: cF};
  });

  const filtered = summaries.filter(s => s.client.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const selectedSummary = summaries.find(s => s.client.id === selectedClientId);

  const statusLabel = (s: string) => s === 'paid' ? 'Paga' : s === 'partially_paid' ? 'Parcial' : 'Pendente';
  const statusStyle = (s: string) => s === 'paid' ? styles.badgePaid : s === 'partially_paid' ? styles.badgePartial : styles.badgePending;

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <View style={globalStyles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={Colors.zinc400} />
        <TextInput style={styles.searchInput} placeholder="Buscar..." placeholderTextColor={Colors.zinc400} value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      {!selectedClientId ? (
        <>
          {/* Tab selector */}
          <View style={styles.tabs}>
            {(['clients', 'fortnights'] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
                <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t === 'clients' ? 'Por Cliente' : 'Por Quinzena'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'clients' ? (
            <FlatList
              data={filtered}
              keyExtractor={item => item.client.id}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <View style={styles.summaryCards}>
                  {[
                    {icon: 'package-variant', color: Colors.blue50, iconColor: Colors.blue600, label: 'Produção Total', value: `${summaries.reduce((a, s) => a + s.totalProduced, 0)} pares`},
                    {icon: 'cash-check', color: Colors.emerald50, iconColor: Colors.emerald600, label: 'Total Recebido', value: `R$ ${formatCurrency(summaries.reduce((a, s) => a + s.paidValue, 0))}`},
                    {icon: 'alert-circle-outline', color: Colors.red50, iconColor: Colors.red600, label: 'Total Pendente', value: `R$ ${formatCurrency(summaries.reduce((a, s) => a + s.pendingValue, 0))}`},
                  ].map(card => (
                    <View key={card.label} style={styles.summaryCard}>
                      <View style={[styles.summaryIcon, {backgroundColor: card.color}]}><Icon name={card.icon} size={20} color={card.iconColor} /></View>
                      <Text style={styles.summaryLabel}>{card.label}</Text>
                      <Text style={styles.summaryValue}>{card.value}</Text>
                    </View>
                  ))}
                </View>
              }
              ListEmptyComponent={<View style={globalStyles.emptyState}><Icon name="account-group-outline" size={48} color={Colors.zinc200} /><Text style={globalStyles.emptyStateText}>Nenhum cliente.</Text></View>}
              renderItem={({item: s}) => (
                <TouchableOpacity style={styles.clientRow} onPress={() => setSelectedClientId(s.client.id)}>
                  <View style={styles.clientAvatar}><Text style={styles.avatarText}>{s.client.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={{flex: 1}}>
                    <Text style={styles.clientName}>{s.client.name}</Text>
                    <Text style={styles.clientPairs}>{s.totalProduced} pares</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.clientTotal}>R$ {formatCurrency(s.totalValue)}</Text>
                    <Text style={[styles.clientPending, {color: s.pendingValue > 0 ? Colors.red600 : Colors.emerald600}]}>
                      {s.pendingValue > 0 ? `- R$ ${formatCurrency(s.pendingValue)}` : 'Quitado'}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={Colors.zinc300} />
                </TouchableOpacity>
              )}
            />
          ) : (
            <FlatList
              data={fortnights.filter(f => (f.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()))}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<View style={globalStyles.emptyState}><Icon name="calendar-blank-outline" size={48} color={Colors.zinc200} /><Text style={globalStyles.emptyStateText}>Nenhuma quinzena.</Text></View>}
              renderItem={({item: f}) => (
                <TouchableOpacity style={styles.fortnightRow} onPress={() => navigation.navigate('FortnightDetails', {fortnightId: f.id})}>
                  <View style={[styles.fortnightStatus, statusStyle(f.status)]}><Icon name="wallet-outline" size={22} color={f.status === 'paid' ? Colors.emerald600 : f.status === 'partially_paid' ? Colors.amber600 : Colors.red600} /></View>
                  <View style={{flex: 1}}>
                    <Text style={styles.fortnightTitle}>{formatFortnight(f.year, f.month, f.period)}</Text>
                    <Text style={styles.fortnightClient}>{f.clientName || 'Cliente'}</Text>
                    <View style={[styles.statusBadge, statusStyle(f.status)]}><Text style={styles.statusBadgeText}>{statusLabel(f.status)}</Text></View>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.fortnightValue}>R$ {formatCurrency(f.totalValue)}</Text>
                    <Text style={[styles.fortnightPending, {color: f.status === 'paid' ? Colors.emerald600 : Colors.red600}]}>
                      R$ {formatCurrency(f.totalValue - f.paidValue)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={Colors.zinc300} />
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        // Client details view
        <FlatList
          data={selectedSummary?.fortnights || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => setSelectedClientId(null)}>
                <Icon name="arrow-left" size={20} color={Colors.zinc500} />
                <Text style={styles.backText}>{selectedSummary?.client.name}</Text>
              </TouchableOpacity>
              <View style={styles.summaryCards}>
                {[
                  {label: 'Total Produzido', value: `${selectedSummary?.totalProduced} pares`, color: Colors.zinc900},
                  {label: 'Valor Total', value: `R$ ${formatCurrency(selectedSummary?.totalValue ?? 0)}`, color: Colors.zinc900},
                  {label: 'Pago', value: `R$ ${formatCurrency(selectedSummary?.paidValue ?? 0)}`, color: Colors.emerald600},
                  {label: 'Pendente', value: `R$ ${formatCurrency(selectedSummary?.pendingValue ?? 0)}`, color: Colors.red600},
                ].map(c => (
                  <View key={c.label} style={[styles.summaryCard, {flex: 1}]}>
                    <Text style={styles.summaryLabel}>{c.label}</Text>
                    <Text style={[styles.summaryValue, {color: c.color, fontSize: 14}]}>{c.value}</Text>
                  </View>
                ))}
              </View>
            </>
          }
          ListEmptyComponent={<View style={globalStyles.emptyState}><Text style={globalStyles.emptyStateText}>Nenhuma quinzena.</Text></View>}
          renderItem={({item: f}) => (
            <TouchableOpacity style={styles.fortnightRow} onPress={() => navigation.navigate('FortnightDetails', {fortnightId: f.id})}>
              <View style={[styles.fortnightStatus, statusStyle(f.status)]}><Icon name="wallet-outline" size={22} color={f.status === 'paid' ? Colors.emerald600 : f.status === 'partially_paid' ? Colors.amber600 : Colors.red600} /></View>
              <View style={{flex: 1}}>
                <Text style={styles.fortnightTitle}>{formatFortnight(f.year, f.month, f.period)}</Text>
                <View style={[styles.statusBadge, statusStyle(f.status)]}><Text style={styles.statusBadgeText}>{statusLabel(f.status)}</Text></View>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.fortnightValue}>R$ {formatCurrency(f.totalValue)}</Text>
                <Text style={[styles.fortnightPending, {color: f.status === 'paid' ? Colors.emerald600 : Colors.red600}]}>R$ {formatCurrency(f.totalValue - f.paidValue)}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={Colors.zinc300} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ─── FortnightDetailsScreen ───────────────────────────────────────────────────

export function FortnightDetailsScreen({route, navigation}: {route: {params: Record<string, any>}; navigation: AppNavigation}) {
  const {fortnightId} = route.params;
  const [fortnight, setFortnight] = useState<Fortnight | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dailySheets, setDailySheets] = useState<DailySheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [observation, setObservation] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubF = onSnapshot(doc(db, 'fortnights', fortnightId), snap => {
      if (snap.exists()) setFortnight({id: snap.id, ...snap.data()} as Fortnight);
    });
    const unsubP = onSnapshot(query(collection(db, 'payments'), where('fortnightId', '==', fortnightId), orderBy('date', 'desc')), snap => {
      const data: Payment[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as Payment));
      setPayments(data);
    });
    const unsubS = onSnapshot(query(collection(db, 'daily_sheets'), where('fortnightId', '==', fortnightId), orderBy('date', 'desc')), snap => {
      const data: DailySheet[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as DailySheet));
      setDailySheets(data);
      setLoading(false);
    });
    return () => {unsubF(); unsubP(); unsubS();};
  }, [fortnightId]);

  const addPayment = async () => {
    if (!auth.currentUser || !fortnight || !amount) return;
    setSaving(true);
    const amt = parseFloat(amount);
    const newPaid = (fortnight.paidValue || 0) + amt;
    const newStatus = newPaid >= fortnight.totalValue ? 'paid' : 'partially_paid';
    try {
      const batch = writeBatch(db);
      const pRef = doc(collection(db, 'payments'));
      batch.set(pRef, {fortnightId, userId: auth.currentUser.uid, amount: amt, date: format(paymentDate, 'yyyy-MM-dd'), observation, createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')});
      batch.update(doc(db, 'fortnights', fortnightId), {paidValue: increment(amt), status: newStatus});
      await batch.commit();
      Toast.show({type: 'success', text1: 'Pagamento registrado!'});
      setPaymentModal(false);
      setAmount(''); setObservation('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'payments');
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async () => {
    if (!paymentToDelete || !fortnight) return;
    try {
      const batch = writeBatch(db);
      const newPaid = fortnight.paidValue - paymentToDelete.amount;
      batch.delete(doc(db, 'payments', paymentToDelete.id));
      batch.update(doc(db, 'fortnights', fortnightId), {paidValue: increment(-paymentToDelete.amount), status: newPaid <= 0 ? 'not_paid' : 'partially_paid'});
      await batch.commit();
      Toast.show({type: 'success', text1: 'Pagamento excluído!'});
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'payments');
    } finally {
      setPaymentToDelete(null);
    }
  };

  if (loading || !fortnight) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  const pending = fortnight.totalValue - fortnight.paidValue;
  const statusLabel = (s: string) => s === 'paid' ? 'Paga' : s === 'partially_paid' ? 'Parcial' : 'Pendente';

  return (
    <View style={globalStyles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.zinc900} />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.detailTitle}>{formatFortnight(fortnight.year, fortnight.month, fortnight.period)}</Text>
          <Text style={styles.detailClient}>{fortnight.clientName || 'Cliente'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.detailContent}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            {label: 'Valor Total', value: `R$ ${formatCurrency(fortnight.totalValue)}`, sub: `${fortnight.totalPairs} pares`, color: Colors.zinc900},
            {label: 'Pago', value: `R$ ${formatCurrency(fortnight.paidValue)}`, sub: statusLabel(fortnight.status), color: Colors.emerald600},
            {label: 'Pendente', value: `R$ ${formatCurrency(pending)}`, sub: 'A receber', color: pending > 0 ? Colors.red600 : Colors.emerald600},
          ].map(card => (
            <View key={card.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{card.label}</Text>
              <Text style={[styles.statValue, {color: card.color}]}>{card.value}</Text>
              <Text style={styles.statSub}>{card.sub}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn2, {backgroundColor: Colors.emerald600}]} onPress={() => {setAmount(String(pending)); setPaymentModal(true);}} disabled={pending <= 0}>
            <Icon name="check-circle-outline" size={18} color={Colors.white} />
            <Text style={styles.actionBtn2Text}>Marcar Pago</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn2, {backgroundColor: Colors.zinc900}]} onPress={() => {setAmount(''); setPaymentModal(true);}}>
            <Icon name="currency-usd" size={18} color={Colors.white} />
            <Text style={styles.actionBtn2Text}>Registrar Pgt.</Text>
          </TouchableOpacity>
        </View>

        {/* Sheets */}
        <Text style={styles.sectionTitle}>Lançamentos Diários</Text>
        <View style={globalStyles.card}>
          {dailySheets.length === 0 ? <Text style={styles.emptyText}>Nenhum lançamento.</Text> : dailySheets.map((sheet, i) => (
            <View key={sheet.id} style={[styles.sheetItem, i > 0 && {borderTopWidth: 1, borderTopColor: Colors.zinc100}]}>
              <View style={styles.sheetIcon}><Icon name="clock-outline" size={16} color={Colors.zinc500} /></View>
              <View style={{flex: 1}}>
                <Text style={styles.sheetDate}>{format(new Date(sheet.date + 'T12:00:00'), 'dd/MM/yyyy')}</Text>
                <Text style={styles.sheetPairs}>{sheet.totalPairs} pares</Text>
              </View>
              <Text style={styles.sheetValue}>R$ {formatCurrency(sheet.totalValue)}</Text>
            </View>
          ))}
        </View>

        {/* Payments */}
        <Text style={[styles.sectionTitle, {marginTop: Spacing.xl}]}>Histórico de Pagamentos</Text>
        <View style={globalStyles.card}>
          {payments.length === 0 ? <Text style={styles.emptyText}>Nenhum pagamento.</Text> : payments.map((p, i) => (
            <View key={p.id} style={[styles.paymentItem, i > 0 && {borderTopWidth: 1, borderTopColor: Colors.zinc100}]}>
              <View style={styles.paymentIcon}><Icon name="check-circle" size={16} color={Colors.emerald600} /></View>
              <View style={{flex: 1}}>
                <Text style={styles.paymentValue}>R$ {formatCurrency(p.amount)}</Text>
                <Text style={styles.paymentDate}>{format(new Date(p.date + 'T12:00:00'), 'dd/MM/yyyy')}</Text>
              </View>
              <TouchableOpacity onPress={() => {setPaymentToDelete(p); setConfirmOpen(true);}}>
                <Icon name="trash-can-outline" size={16} color={Colors.red500} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={paymentModal} animationType="slide" transparent onRequestClose={() => setPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Registrar Pagamento</Text>
              <TouchableOpacity onPress={() => setPaymentModal(false)}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity>
            </View>
            <Text style={globalStyles.label}>Valor (R$) *</Text>
            <TextInput style={globalStyles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={Colors.zinc400} autoFocus />
            <Text style={styles.pendingHint}>Saldo Pendente: R$ {formatCurrency(pending)}</Text>
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Data do Pagamento</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Icon name="calendar" size={18} color={Colors.zinc500} />
              <Text style={styles.dateBtnText}>{format(paymentDate, 'dd/MM/yyyy')}</Text>
            </TouchableOpacity>
            {showDatePicker && <DateTimePicker value={paymentDate} mode="date" display="default" onChange={(_, d) => {setShowDatePicker(false); if (d) setPaymentDate(d);}} />}
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Observação</Text>
            <TextInput style={[globalStyles.input, {height: 70, textAlignVertical: 'top'}]} value={observation} onChangeText={setObservation} multiline placeholder="Ex: Pago via PIX" placeholderTextColor={Colors.zinc400} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[globalStyles.secondaryButton, {flex: 1}]} onPress={() => setPaymentModal(false)}><Text style={globalStyles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[globalStyles.primaryButton, {flex: 1}]} onPress={addPayment} disabled={saving}>{saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal isOpen={confirmOpen} onClose={() => {setConfirmOpen(false); setPaymentToDelete(null);}} onConfirm={deletePayment} title="Excluir Pagamento" message="Ação irreversível." confirmLabel="Excluir" />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  searchBar: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, margin: Spacing.xl, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.zinc200},
  searchInput: {flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.zinc900},
  tabs: {flexDirection: 'row', backgroundColor: Colors.zinc100, margin: Spacing.xl, marginTop: 0, borderRadius: Radius.xl, padding: 4},
  tab: {flex: 1, paddingVertical: 10, borderRadius: Radius.lg, alignItems: 'center'},
  tabActive: {backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2},
  tabText: {fontSize: 13, fontWeight: '700', color: Colors.zinc500},
  tabTextActive: {color: Colors.zinc900},
  list: {paddingHorizontal: Spacing.xl, paddingBottom: 40},
  summaryCards: {flexDirection: 'row', gap: 8, marginBottom: Spacing.xl, flexWrap: 'wrap'},
  summaryCard: {backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.zinc100, minWidth: '30%'},
  summaryIcon: {width: 36, height: 36, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 8},
  summaryLabel: {fontSize: 11, color: Colors.zinc500, fontWeight: '600'},
  summaryValue: {fontSize: 15, fontWeight: '700', color: Colors.zinc900, marginTop: 2},
  clientRow: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.zinc100},
  clientAvatar: {width: 40, height: 40, backgroundColor: Colors.zinc100, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 16, fontWeight: '700', color: Colors.zinc600},
  clientName: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  clientPairs: {fontSize: 12, color: Colors.zinc500},
  clientTotal: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  clientPending: {fontSize: 12, fontWeight: '600'},
  fortnightRow: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.zinc100},
  fortnightStatus: {width: 44, height: 44, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center'},
  badgePaid: {backgroundColor: Colors.emerald50},
  badgePartial: {backgroundColor: Colors.amber50},
  badgePending: {backgroundColor: Colors.red50},
  fortnightTitle: {fontSize: 13, fontWeight: '700', color: Colors.zinc900},
  fortnightClient: {fontSize: 11, color: Colors.zinc400, marginTop: 2},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, alignSelf: 'flex-start', marginTop: 4},
  statusBadgeText: {fontSize: 10, fontWeight: '700', color: Colors.zinc600},
  fortnightValue: {fontSize: 13, fontWeight: '700', color: Colors.zinc900},
  fortnightPending: {fontSize: 12, fontWeight: '600'},
  backRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg},
  backText: {fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  // FortnightDetails styles
  detailHeader: {flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.zinc100},
  backBtn: {padding: 8, marginRight: 8},
  detailTitle: {fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  detailClient: {fontSize: 13, color: Colors.zinc500},
  detailContent: {padding: Spacing.xl, paddingBottom: 40},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: Spacing.xl},
  statCard: {flex: 1, backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.zinc100},
  statLabel: {fontSize: 10, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', marginBottom: 4},
  statValue: {fontSize: 14, fontWeight: '900', color: Colors.zinc900},
  statSub: {fontSize: 11, color: Colors.zinc500, marginTop: 2},
  actionsRow: {flexDirection: 'row', gap: 12, marginBottom: Spacing.xl},
  actionBtn2: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.xl},
  actionBtn2Text: {fontWeight: '700', color: Colors.white, fontSize: 13},
  sectionTitle: {fontSize: 15, fontWeight: '700', color: Colors.zinc900, marginBottom: Spacing.md},
  sheetItem: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12},
  sheetIcon: {width: 36, height: 36, backgroundColor: Colors.zinc100, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center'},
  sheetDate: {fontSize: 13, fontWeight: '600', color: Colors.zinc900},
  sheetPairs: {fontSize: 12, color: Colors.zinc500},
  sheetValue: {fontSize: 13, fontWeight: '700', color: Colors.zinc900},
  paymentItem: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12},
  paymentIcon: {width: 36, height: 36, backgroundColor: Colors.emerald50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center'},
  paymentValue: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  paymentDate: {fontSize: 12, color: Colors.zinc500},
  emptyText: {textAlign: 'center', color: Colors.zinc400, paddingVertical: 20},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end'},
  modalBox: {backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xxl, maxHeight: '80%'},
  modalHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl},
  modalTitle: {fontSize: 18, fontWeight: '700', color: Colors.zinc900},
  pendingHint: {fontSize: 10, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', marginTop: 4},
  dateBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.zinc50, borderWidth: 1, borderColor: Colors.zinc200, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 12},
  dateBtnText: {fontSize: 15, color: Colors.zinc900, fontWeight: '600'},
  modalBtns: {flexDirection: 'row', gap: 12, marginTop: Spacing.xl},
});
