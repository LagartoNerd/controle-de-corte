import React, {useState, useEffect} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import {launchImageLibrary} from 'react-native-image-picker';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {Model, UserProfile, GlobalConfig, Client} from '../types';
import {handleFirestoreError, OperationType} from '../utils/error';
import {ConfirmModal} from '../components/ConfirmModal';
import {Colors, Radius, Spacing, globalStyles} from '../theme';

interface Props {
  navigation: AppNavigation;
  profile: UserProfile | null;
}

export function ModelsScreen({navigation, profile}: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [colorCounts, setColorCounts] = useState<{[k: string]: number}>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const unsubModels = onSnapshot(query(collection(db, 'models'), where('userId', '==', uid)), snap => {
      const data: Model[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as Model));
      setModels(data);
      setLoading(false);
    });
    const unsubColors = onSnapshot(query(collection(db, 'model_colors'), where('userId', '==', uid)), snap => {
      const counts: {[k: string]: number} = {};
      snap.forEach(d => { const md = d.data().modelId; counts[md] = (counts[md] || 0) + 1; });
      setColorCounts(counts);
    });
    const unsubClients = onSnapshot(query(collection(db, 'clients'), where('userId', '==', uid)), snap => {
      const data: Client[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as Client));
      setClients(data.sort((a, b) => a.name.localeCompare(b.name)));
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'global'), d => {
      if (d.exists()) setConfig(d.data() as GlobalConfig);
    });
    return () => { unsubModels(); unsubColors(); unsubClients(); unsubConfig(); };
  }, []);

  const pickImage = async () => {
    const result = await launchImageLibrary({mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 800, maxHeight: 800});
    if (result.assets?.[0]) {
      setImageUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const openModal = (model?: Model) => {
    if (model) {
      setEditingModel(model);
      setName(model.name); setCode(model.code);
      setClientId(model.clientId); setUnitValue(model.unitValue.toString());
      setDescription(model.description || '');
      setImageUri(model.photoUrl || null);
    } else {
      setEditingModel(null);
      setName(''); setCode(''); setClientId(clients[0]?.id || '');
      setUnitValue(''); setDescription(''); setImageUri(null);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!auth.currentUser || !profile) return;
    const effectivePlan = profile.trialStartDate ? profile.trialPlan : profile.plan;
    let maxModels = config?.freeModelLimit || 5;
    if (effectivePlan && config?.features?.[effectivePlan as keyof typeof config.features]) {
      maxModels = config.features[effectivePlan as keyof typeof config.features].maxModels;
    }
    if (!editingModel && models.length >= maxModels) {
      Toast.show({type: 'error', text1: `Limite de ${maxModels} modelos atingido. Faça upgrade.`});
      return;
    }
    if (!name.trim() || !code.trim() || !unitValue) {
      Toast.show({type: 'error', text1: 'Preencha todos os campos obrigatórios.'});
      return;
    }
    setSaving(true);
    try {
      const data = {
        userId: auth.currentUser.uid, clientId, name, code,
        unitValue: parseFloat(unitValue), description,
        photoUrl: imageUri || '', status: 'active', updatedAt: serverTimestamp(),
      };
      if (editingModel) {
        await updateDoc(doc(db, 'models', editingModel.id), data);
      } else {
        await addDoc(collection(db, 'models'), {...data, createdAt: serverTimestamp()});
      }
      Toast.show({type: 'success', text1: editingModel ? 'Modelo atualizado!' : 'Modelo cadastrado!'});
      setModalOpen(false);
    } catch (e) {
      handleFirestoreError(e, editingModel ? OperationType.UPDATE : OperationType.CREATE, 'models');
    } finally {
      setSaving(false);
    }
  };

  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const ClientPicker = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: Spacing.md}}>
      {clients.map(c => (
        <TouchableOpacity
          key={c.id}
          style={[styles.clientChip, clientId === c.id && styles.clientChipActive]}
          onPress={() => setClientId(c.id)}>
          <Text style={[styles.clientChipText, clientId === c.id && {color: Colors.white}]}>{c.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <View style={globalStyles.container}>
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={Colors.zinc400} />
        <TextInput style={styles.searchInput} placeholder="Buscar por nome ou código..." placeholderTextColor={Colors.zinc400} value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={{gap: 12}}
        ListEmptyComponent={
          <View style={globalStyles.emptyState}>
            <Icon name="shoe-sneaker" size={48} color={Colors.zinc200} />
            <Text style={globalStyles.emptyStateText}>Nenhum modelo encontrado.</Text>
          </View>
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardImage}
              onPress={() => navigation.navigate('ModelDetails', {modelId: item.id})}>
              {item.photoUrl ? (
                <Image source={{uri: item.photoUrl}} style={styles.modelPhoto} />
              ) : (
                <Icon name="shoe-sneaker" size={40} color={Colors.zinc300} />
              )}
            </TouchableOpacity>
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.modelName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.modelCode}>{item.code}</Text>
              </View>
              <Text style={styles.colorCount}>{colorCounts[item.id] || 0} variações</Text>
              <Text style={styles.modelPrice}>R$ {formatCurrency(item.unitValue)}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('ModelDetails', {modelId: item.id})}>
                  <Text style={styles.manageBtnText}>Gerenciar</Text>
                  <Icon name="arrow-right" size={14} color={Colors.zinc900} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openModal(item)}>
                  <Icon name="pencil-outline" size={16} color={Colors.zinc500} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => {setModelToDelete(item.id); setConfirmOpen(true);}}>
                  <Icon name="trash-can-outline" size={16} color={Colors.red500} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Icon name="plus" size={28} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingModel ? 'Editar Modelo' : 'Novo Modelo'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image picker */}
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                {imageUri ? (
                  <Image source={{uri: imageUri}} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon name="camera-plus-outline" size={32} color={Colors.zinc300} />
                    <Text style={styles.imagePlaceholderText}>Adicionar Foto</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={globalStyles.label}>Cliente / Fábrica *</Text>
              {clients.length === 0 ? (
                <Text style={styles.errorHint}>Cadastre um cliente primeiro.</Text>
              ) : (
                <ClientPicker />
              )}

              <Text style={globalStyles.label}>Nome do Modelo *</Text>
              <TextInput style={globalStyles.input} value={name} onChangeText={setName} placeholder="Ex: Tênis Sport" placeholderTextColor={Colors.zinc400} />

              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Código *</Text>
              <TextInput style={globalStyles.input} value={code} onChangeText={setCode} placeholder="Ex: TS-001" placeholderTextColor={Colors.zinc400} autoCapitalize="characters" />

              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Valor Unitário (R$) *</Text>
              <TextInput style={globalStyles.input} value={unitValue} onChangeText={setUnitValue} placeholder="0,00" placeholderTextColor={Colors.zinc400} keyboardType="decimal-pad" />

              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Descrição</Text>
              <TextInput style={[globalStyles.input, {height: 80, textAlignVertical: 'top'}]} value={description} onChangeText={setDescription} placeholder="Detalhes sobre o modelo..." placeholderTextColor={Colors.zinc400} multiline />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[globalStyles.secondaryButton, {flex: 1}]} onPress={() => setModalOpen(false)}>
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
        onClose={() => {setConfirmOpen(false); setModelToDelete(null);}}
        onConfirm={async () => {
          if (!modelToDelete) return;
          try {
            await deleteDoc(doc(db, 'models', modelToDelete));
            Toast.show({type: 'success', text1: 'Modelo excluído!'});
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'models');
          } finally { setModelToDelete(null); }
        }}
        title="Excluir Modelo"
        message="Deseja excluir este modelo? Ação irreversível."
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
  card: {flex: 1, backgroundColor: Colors.white, borderRadius: Radius.xxl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.zinc100, marginBottom: 12},
  cardImage: {height: 130, backgroundColor: Colors.zinc100, alignItems: 'center', justifyContent: 'center'},
  modelPhoto: {width: '100%', height: '100%'},
  cardBody: {padding: 12},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4},
  modelName: {fontSize: 13, fontWeight: '700', color: Colors.zinc900, flex: 1},
  modelCode: {fontSize: 10, fontWeight: '700', backgroundColor: Colors.zinc100, color: Colors.zinc600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6},
  colorCount: {fontSize: 11, color: Colors.zinc400, marginBottom: 4},
  modelPrice: {fontSize: 14, fontWeight: '700', color: Colors.zinc900, marginBottom: 8},
  cardActions: {flexDirection: 'row', alignItems: 'center', gap: 4},
  manageBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.zinc100, borderRadius: Radius.lg, paddingVertical: 7},
  manageBtnText: {fontSize: 11, fontWeight: '700', color: Colors.zinc900},
  iconBtn: {padding: 7, backgroundColor: Colors.zinc50, borderRadius: Radius.lg},
  fab: {position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, backgroundColor: Colors.zinc900, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xxl, maxHeight: '92%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl},
  modalTitle: {fontSize: 20, fontWeight: '700', color: Colors.zinc900},
  imagePickerBtn: {alignSelf: 'center', marginBottom: Spacing.xl},
  imagePreview: {width: 120, height: 120, borderRadius: 20},
  imagePlaceholder: {width: 120, height: 120, backgroundColor: Colors.zinc100, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.zinc200, borderStyle: 'dashed'},
  imagePlaceholderText: {fontSize: 11, color: Colors.zinc400, marginTop: 6},
  clientChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.zinc100, marginRight: 8},
  clientChipActive: {backgroundColor: Colors.zinc900},
  clientChipText: {fontSize: 13, fontWeight: '600', color: Colors.zinc600},
  errorHint: {fontSize: 12, color: Colors.red500, marginBottom: Spacing.md},
  modalButtons: {flexDirection: 'row', gap: 12, marginTop: Spacing.xxl},
});
