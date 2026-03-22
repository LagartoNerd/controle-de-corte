import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator} from 'react-native';
import {collection, query, where, onSnapshot, orderBy, doc, getDocs, writeBatch, increment}} from 'firebase/firestore';
import {format} from 'date-fns';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {DailySheet, UserProfile} from '../types';
import {handleFirestoreError, OperationType} from '../utils/error';
import {ConfirmModal} from '../components/ConfirmModal';
import {Colors, Radius, Spacing, globalStyles} from '../theme';
import {AdBanner} from '../components/AdMob';

interface Props {navigation: AppNavigation; profile: UserProfile | null}

export function DailySheetsListScreen({navigation, profile}: Props) {
  const [sheets, setSheets] = useState<DailySheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<DailySheet | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(
      query(collection(db, 'daily_sheets'), where('userId', '==', auth.currentUser.uid), orderBy('date', 'desc')),
      snap => {
        const data: DailySheet[] = [];
        snap.forEach(d => data.push({id: d.id, ...d.data()} as DailySheet));
        setSheets(data);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const confirmDelete = async () => {
    if (!sheetToDelete) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'fortnights', sheetToDelete.fortnightId), {
        totalPairs: increment(-sheetToDelete.totalPairs),
        totalValue: increment(-sheetToDelete.totalValue),
      });
      batch.delete(doc(db, 'daily_sheets', sheetToDelete.id));
      const itemsSnap = await getDocs(query(collection(db, 'daily_sheet_items'), where('sheetId', '==', sheetToDelete.id)));
      itemsSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      Toast.show({type: 'success', text1: 'Ficha excluída!'});
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'daily_sheets');
    } finally {
      setSheetToDelete(null);
    }
  };

  const filtered = sheets.filter(s =>
    s.date.includes(searchTerm) || (s.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <View style={globalStyles.container}>
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={Colors.zinc400} />
        <TextInput style={styles.searchInput} placeholder="Buscar por data ou cliente..." placeholderTextColor={Colors.zinc400} value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      <AdBanner profile={profile} />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={globalStyles.emptyState}>
            <Icon name="clipboard-list-outline" size={48} color={Colors.zinc200} />
            <Text style={globalStyles.emptyStateText}>Nenhum lançamento encontrado.</Text>
          </View>
        }
        renderItem={({item}) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('DailySheetForm', {sheetId: item.id})}>
            <View style={styles.rowIconBox}>
              <Icon name="calendar-outline" size={20} color={Colors.zinc500} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.rowDate}>{format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy')}</Text>
              <Text style={styles.rowClient}>{item.clientName || 'Cliente'}</Text>
              <View style={styles.quinzBadge}>
                <Text style={styles.quinzText}>{item.fortnightId.split('_').slice(-1)[0]}ª Quinzena</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>R$ {formatCurrency(item.totalValue)}</Text>
              <Text style={styles.rowPairs}>{item.totalPairs} pares</Text>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => {setSheetToDelete(item); setConfirmOpen(true);}}>
              <Icon name="trash-can-outline" size={18} color={Colors.red500} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('DailySheetForm')}>
        <Icon name="plus" size={28} color={Colors.white} />
      </TouchableOpacity>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {setConfirmOpen(false); setSheetToDelete(null);}}
        onConfirm={confirmDelete}
        title="Excluir Ficha"
        message="Isso afetará o saldo da quinzena. Ação irreversível."
        confirmLabel="Excluir"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  searchBar: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, margin: Spacing.xl, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.zinc200},
  searchInput: {flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.zinc900},
  list: {paddingHorizontal: Spacing.xl, paddingBottom: 100},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.zinc100},
  rowIconBox: {width: 40, height: 40, backgroundColor: Colors.zinc100, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center'},
  rowDate: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  rowClient: {fontSize: 12, color: Colors.zinc500, marginTop: 2},
  quinzBadge: {backgroundColor: Colors.blue50, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4},
  quinzText: {fontSize: 10, fontWeight: '700', color: Colors.blue600},
  rowRight: {alignItems: 'flex-end'},
  rowValue: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  rowPairs: {fontSize: 12, color: Colors.zinc500},
  deleteBtn: {padding: 6},
  fab: {position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, backgroundColor: Colors.zinc900, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8},
});
