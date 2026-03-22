import React, {useState, useEffect} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {Client, UserProfile, GlobalConfig} from '../types';
import {handleFirestoreError, OperationType} from '../utils/error';
import {ConfirmModal} from '../components/ConfirmModal';
import {Colors, Radius, Spacing, globalStyles} from '../theme';

interface Props {profile: UserProfile | null}

export function ClientsScreen({profile}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(
      query(collection(db, 'clients'), where('userId', '==', auth.currentUser.uid)),
      snap => {
        const data: Client[] = [];
        snap.forEach(d => data.push({id: d.id, ...d.data()} as Client));
        setClients(data.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      },
    );
    const unsubConfig = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
    });
    return () => { unsub(); unsubConfig(); };
  }, []);

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setName(client.name);
      setPhone(client.phone || '');
      setAddress(client.address || '');
    } else {
      setEditingClient(null);
      setName(''); setPhone(''); setAddress('');
    }
    setModalOpen(true);
  };

  const closeModal = () => {setModalOpen(false); setEditingClient(null);};

  const handleSave = async () => {
    if (!auth.currentUser || !profile || !name.trim()) return;
    if (!editingClient && config) {
      const effectivePlan = profile.trialStartDate ? profile.trialPlan : profile.plan;
      const limit = effectivePlan === 'free' ? config.freeClientLimit
        : config.features[effectivePlan as keyof typeof config.features]?.maxClients || 9999;
      if (clients.length >= limit) {
        Toast.show({type: 'error', text1: `Limite de ${limit} clientes atingido. Faça upgrade.`});
        return;
      }
    }
    setSaving(true);
    try {
      const data = {userId: auth.currentUser.uid, name, phone, address, updatedAt: serverTimestamp()};
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), data);
      } else {
        await addDoc(collection(db, 'clients'), {...data, createdAt: serverTimestamp()});
      }
      Toast.show({type: 'success', text1: editingClient ? 'Cliente atualizado!' : 'Cliente cadastrado!'});
      closeModal();
    } catch (e) {
      handleFirestoreError(e, editingClient ? OperationType.UPDATE : OperationType.CREATE, 'clients');
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <View style={globalStyles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={Colors.zinc400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome..."
          placeholderTextColor={Colors.zinc400}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={globalStyles.emptyState}>
            <Icon name="account-group-outline" size={48} color={Colors.zinc200} />
            <Text style={globalStyles.emptyStateText}>Nenhum cliente encontrado.</Text>
          </View>
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.clientName}>{item.name}</Text>
                {item.phone && (
                  <View style={styles.infoRow}>
                    <Icon name="phone-outline" size={13} color={Colors.zinc400} />
                    <Text style={styles.infoText}>{item.phone}</Text>
                  </View>
                )}
                {item.address && (
                  <View style={styles.infoRow}>
                    <Icon name="map-marker-outline" size={13} color={Colors.zinc400} />
                    <Text style={styles.infoText} numberOfLines={1}>{item.address}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}>
                <Icon name="pencil-outline" size={18} color={Colors.zinc500} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => {setClientToDelete(item.id); setConfirmOpen(true);}}>
                <Icon name="trash-can-outline" size={18} color={Colors.red500} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Icon name="plus" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</Text>
              <TouchableOpacity onPress={closeModal}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={globalStyles.label}>Nome da Fábrica / Cliente *</Text>
              <TextInput style={globalStyles.input} value={name} onChangeText={setName} placeholder="Ex: Fábrica Silva" placeholderTextColor={Colors.zinc400} />
              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Telefone</Text>
              <TextInput style={globalStyles.input} value={phone} onChangeText={setPhone} placeholder="(00) 00000-0000" placeholderTextColor={Colors.zinc400} keyboardType="phone-pad" />
              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Endereço</Text>
              <TextInput style={[globalStyles.input, {height: 80, textAlignVertical: 'top'}]} value={address} onChangeText={setAddress} placeholder="Rua, Número, Bairro..." placeholderTextColor={Colors.zinc400} multiline />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={globalStyles.secondaryButton} onPress={closeModal}>
                  <Text style={globalStyles.secondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[globalStyles.primaryButton, {flex: 1}]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {setConfirmOpen(false); setClientToDelete(null);}}
        onConfirm={async () => {
          if (!clientToDelete) return;
          try {
            await deleteDoc(doc(db, 'clients', clientToDelete));
            Toast.show({type: 'success', text1: 'Cliente excluído!'});
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'clients');
          } finally {
            setClientToDelete(null);
          }
        }}
        title="Excluir Cliente"
        message="Deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, margin: Spacing.xl,
    borderRadius: Radius.xl, paddingHorizontal: Spacing.lg,
    borderWidth: 1, borderColor: Colors.zinc200,
  },
  searchInput: {flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.zinc900},
  list: {paddingHorizontal: Spacing.xl, paddingBottom: 100},
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xxl,
    padding: Spacing.xl, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.zinc100,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLeft: {flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1},
  avatar: {width: 44, height: 44, backgroundColor: Colors.zinc100, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 18, fontWeight: '700', color: Colors.zinc600},
  clientName: {fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  infoRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3},
  infoText: {fontSize: 12, color: Colors.zinc500},
  actions: {flexDirection: 'row', gap: 4},
  actionBtn: {padding: 8},
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, backgroundColor: Colors.zinc900,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xxl, maxHeight: '85%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl},
  modalTitle: {fontSize: 20, fontWeight: '700', color: Colors.zinc900},
  modalButtons: {flexDirection: 'row', gap: 12, marginTop: Spacing.xxl},
});
