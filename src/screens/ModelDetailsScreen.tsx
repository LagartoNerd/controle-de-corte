// ModelDetailsScreen.tsx
import React, {useState, useEffect} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, ActivityIndicator, Image,
} from 'react-native';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, getDoc,
} from 'firebase/firestore';
import {launchImageLibrary} from 'react-native-image-picker';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {db, auth} from '../firebase';
import {Model, ModelColor, ModelMaterial, ModelMold, AppNavigation} from '../types';
import {handleFirestoreError, OperationType} from '../utils/error';
import {ConfirmModal} from '../components/ConfirmModal';
import {Colors, Radius, Spacing, globalStyles} from '../theme';
import {formatCurrency} from '../utils/fortnight';

type Tab = 'details' | 'colors' | 'materials' | 'molds';

export function ModelDetailsScreen({route, navigation}: {route: {params: Record<string, any>}; navigation: AppNavigation}) {
  const {modelId} = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [model, setModel] = useState<Model | null>(null);
  const [colors, setColors] = useState<ModelColor[]>([]);
  const [materials, setMaterials] = useState<ModelMaterial[]>([]);
  const [molds, setMolds] = useState<ModelMold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [colorModal, setColorModal] = useState(false);
  const [materialModal, setMaterialModal] = useState(false);
  const [moldModal, setMoldModal] = useState(false);
  const [modelModal, setModelModal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{title: string; message: string; onConfirm: () => void} | null>(null);

  // Editing
  const [editingColor, setEditingColor] = useState<ModelColor | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<ModelMaterial | null>(null);
  const [editingMold, setEditingMold] = useState<ModelMold | null>(null);

  // Forms
  const [colorName, setColorName] = useState('');
  const [colorPhoto, setColorPhoto] = useState('');
  const [colorObs, setColorObs] = useState('');
  const [colorMaterials, setColorMaterials] = useState<string[]>([]);
  const [matName, setMatName] = useState('');
  const [matCutType, setMatCutType] = useState<'conjugado'|'individual'>('conjugado');
  const [matObs, setMatObs] = useState('');
  const [moldName, setMoldName] = useState('');
  const [moldMaterialId, setMoldMaterialId] = useState('');
  const [moldCutType, setMoldCutType] = useState<'conjugado'|'individual'>('conjugado');
  const [modelName, setModelName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [modelValue, setModelValue] = useState('');
  const [modelDesc, setModelDesc] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'models', modelId)).then(d => {
      if (d.exists()) setModel({id: d.id, ...d.data()} as Model);
    });
    const unsubColors = onSnapshot(query(collection(db, 'model_colors'), where('modelId', '==', modelId)), snap => {
      setColors(snap.docs.map(d => ({id: d.id, ...d.data()} as ModelColor)));
    });
    const unsubMats = onSnapshot(query(collection(db, 'model_materials'), where('modelId', '==', modelId)), snap => {
      setMaterials(snap.docs.map(d => ({id: d.id, ...d.data()} as ModelMaterial)));
    });
    const unsubMolds = onSnapshot(query(collection(db, 'model_molds'), where('modelId', '==', modelId)), snap => {
      setMolds(snap.docs.map(d => ({id: d.id, ...d.data()} as ModelMold)));
      setLoading(false);
    });
    return () => { unsubColors(); unsubMats(); unsubMolds(); };
  }, [modelId]);

  const pickColorImage = async () => {
    const result = await launchImageLibrary({mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 600, maxHeight: 600});
    if (result.assets?.[0]) setColorPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const openColorModal = (color?: ModelColor) => {
    setEditingColor(color || null);
    setColorName(color?.name || '');
    setColorPhoto(color?.photoUrl || '');
    setColorObs(color?.observation || '');
    setColorMaterials(color?.materialIds || []);
    setColorModal(true);
  };

  const saveColor = async () => {
    if (!auth.currentUser || !colorName.trim()) return;
    setSaving(true);
    try {
      const data = {name: colorName, photoUrl: colorPhoto, observation: colorObs, status: 'active', materialIds: colorMaterials, modelId, userId: auth.currentUser.uid};
      if (editingColor) await updateDoc(doc(db, 'model_colors', editingColor.id), data);
      else await addDoc(collection(db, 'model_colors'), data);
      Toast.show({type: 'success', text1: editingColor ? 'Cor atualizada!' : 'Cor adicionada!'});
      setColorModal(false);
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, 'model_colors'); }
    finally { setSaving(false); }
  };

  const openMaterialModal = (mat?: ModelMaterial) => {
    setEditingMaterial(mat || null);
    setMatName(mat?.name || '');
    setMatCutType(mat?.cutType || 'conjugado');
    setMatObs(mat?.observation || '');
    setMaterialModal(true);
  };

  const saveMaterial = async () => {
    if (!auth.currentUser || !matName.trim()) return;
    setSaving(true);
    try {
      const data = {name: matName, cutType: matCutType, status: 'active', observation: matObs, modelId, userId: auth.currentUser.uid};
      if (editingMaterial) await updateDoc(doc(db, 'model_materials', editingMaterial.id), data);
      else await addDoc(collection(db, 'model_materials'), data);
      Toast.show({type: 'success', text1: editingMaterial ? 'Material atualizado!' : 'Material adicionado!'});
      setMaterialModal(false);
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, 'model_materials'); }
    finally { setSaving(false); }
  };

  const openMoldModal = (mold?: ModelMold) => {
    setEditingMold(mold || null);
    setMoldName(mold?.name || '');
    setMoldMaterialId(mold?.materialId || materials[0]?.id || '');
    setMoldCutType(mold?.cutType || 'conjugado');
    setMoldModal(true);
  };

  const saveMold = async () => {
    if (!auth.currentUser || !moldName.trim() || !moldMaterialId) return;
    setSaving(true);
    try {
      const data = {name: moldName, materialId: moldMaterialId, cutType: moldCutType, modelId, userId: auth.currentUser.uid};
      if (editingMold) await updateDoc(doc(db, 'model_molds', editingMold.id), data);
      else await addDoc(collection(db, 'model_molds'), data);
      Toast.show({type: 'success', text1: 'Molde salvo!'});
      setMoldModal(false);
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, 'model_molds'); }
    finally { setSaving(false); }
  };

  const saveModel = async () => {
    if (!modelName.trim() || !modelCode.trim() || !modelValue) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'models', modelId), {name: modelName, code: modelCode, unitValue: parseFloat(modelValue), description: modelDesc});
      setModel(prev => prev ? {...prev, name: modelName, code: modelCode, unitValue: parseFloat(modelValue), description: modelDesc} : null);
      Toast.show({type: 'success', text1: 'Modelo atualizado!'});
      setModelModal(false);
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'models'); }
    finally { setSaving(false); }
  };

  const tabs: {id: Tab; label: string; icon: string}[] = [
    {id: 'details', label: 'Dados', icon: 'information-outline'},
    {id: 'colors', label: 'Cores', icon: 'palette-outline'},
    {id: 'materials', label: 'Materiais', icon: 'layers-outline'},
    {id: 'molds', label: 'Moldes', icon: 'scissors-cutting'},
  ];

  if (loading || !model)
    return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  return (
    <View style={globalStyles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.zinc900} />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>{model.name}</Text>
          <Text style={styles.headerSub}>Código: {model.code} • R$ {formatCurrency(model.unitValue)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{padding: 4, gap: 4}}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} size={16} color={activeTab === tab.id ? Colors.zinc900 : Colors.zinc500} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <View style={globalStyles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Informações Gerais</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => {
                setModelName(model.name); setModelCode(model.code);
                setModelValue(model.unitValue.toString()); setModelDesc(model.description || '');
                setModelModal(true);
              }}>
                <Icon name="pencil" size={14} color={Colors.zinc600} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            </View>
            {model.photoUrl ? (
              <Image source={{uri: model.photoUrl}} style={styles.modelImage} />
            ) : null}
            {[{label: 'Nome', value: model.name}, {label: 'Código', value: model.code}, {label: 'Valor Unitário', value: `R$ ${formatCurrency(model.unitValue)}`}, ...(model.description ? [{label: 'Descrição', value: model.description}] : [])].map(item => (
              <View key={item.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* COLORS TAB */}
        {activeTab === 'colors' && (
          <View>
            <TouchableOpacity style={[globalStyles.primaryButton, {marginBottom: Spacing.lg}]} onPress={() => openColorModal()}>
              <Icon name="plus" size={20} color={Colors.white} />
              <Text style={globalStyles.primaryButtonText}>Adicionar Cor</Text>
            </TouchableOpacity>
            {colors.length === 0 ? (
              <View style={globalStyles.emptyState}><Icon name="palette-outline" size={48} color={Colors.zinc200} /><Text style={globalStyles.emptyStateText}>Nenhuma cor cadastrada.</Text></View>
            ) : colors.map(color => (
              <View key={color.id} style={[globalStyles.card, {marginBottom: 12}]}>
                <View style={styles.colorHeader}>
                  <View style={styles.colorThumb}>
                    {color.photoUrl ? <Image source={{uri: color.photoUrl}} style={styles.colorThumbImg} /> : <Icon name="palette" size={24} color={Colors.zinc400} />}
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.colorName}>{color.name}</Text>
                    <Text style={styles.colorSub}>{color.observation || 'Sem observações.'}</Text>
                    <View style={styles.matChips}>
                      {color.materialIds?.map(mId => {
                        const mat = materials.find(m => m.id === mId);
                        return mat ? <View key={mId} style={styles.matChip}><Text style={styles.matChipText}>{mat.name}</Text></View> : null;
                      })}
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity onPress={() => openColorModal(color)}><Icon name="pencil-outline" size={18} color={Colors.zinc500} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => {setConfirmConfig({title: 'Excluir Cor', message: 'Excluir esta cor?', onConfirm: async () => { await deleteDoc(doc(db, 'model_colors', color.id)); Toast.show({type: 'success', text1: 'Cor excluída!'}); }}); setConfirmOpen(true);}}>
                      <Icon name="trash-can-outline" size={18} color={Colors.red500} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MATERIALS TAB */}
        {activeTab === 'materials' && (
          <View>
            <TouchableOpacity style={[globalStyles.primaryButton, {marginBottom: Spacing.lg}]} onPress={() => openMaterialModal()}>
              <Icon name="plus" size={20} color={Colors.white} />
              <Text style={globalStyles.primaryButtonText}>Adicionar Material</Text>
            </TouchableOpacity>
            {materials.length === 0 ? (
              <View style={globalStyles.emptyState}><Icon name="layers-outline" size={48} color={Colors.zinc200} /><Text style={globalStyles.emptyStateText}>Nenhum material cadastrado.</Text></View>
            ) : materials.map(mat => (
              <View key={mat.id} style={[globalStyles.card, {marginBottom: 12, flexDirection: 'row', alignItems: 'center'}]}>
                <View style={{flex: 1}}>
                  <Text style={styles.matName}>{mat.name}</Text>
                  <View style={styles.matTagRow}>
                    <View style={[styles.matTag, mat.cutType === 'conjugado' ? styles.tagBlue : styles.tagAmber]}>
                      <Text style={styles.matTagText}>{mat.cutType === 'conjugado' ? 'Conjugado' : 'Individual'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => openMaterialModal(mat)}><Icon name="pencil-outline" size={18} color={Colors.zinc500} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => {setConfirmConfig({title: 'Excluir Material', message: 'Excluir este material?', onConfirm: async () => { await deleteDoc(doc(db, 'model_materials', mat.id)); Toast.show({type: 'success', text1: 'Material excluído!'}); }}); setConfirmOpen(true);}}>
                    <Icon name="trash-can-outline" size={18} color={Colors.red500} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MOLDS TAB */}
        {activeTab === 'molds' && (
          <View>
            <TouchableOpacity style={[globalStyles.primaryButton, {marginBottom: Spacing.lg}]} onPress={() => openMoldModal()}>
              <Icon name="plus" size={20} color={Colors.white} />
              <Text style={globalStyles.primaryButtonText}>Adicionar Molde</Text>
            </TouchableOpacity>
            {molds.length === 0 ? (
              <View style={globalStyles.emptyState}><Icon name="scissors-cutting" size={48} color={Colors.zinc200} /><Text style={globalStyles.emptyStateText}>Nenhum molde cadastrado.</Text></View>
            ) : molds.map(mold => (
              <View key={mold.id} style={[globalStyles.card, {marginBottom: 12, flexDirection: 'row', alignItems: 'center'}]}>
                <View style={{flex: 1}}>
                  <Text style={styles.matName}>{mold.name}</Text>
                  <Text style={styles.moldMatName}>{materials.find(m => m.id === mold.materialId)?.name || '—'}</Text>
                  <View style={[styles.matTag, mold.cutType === 'conjugado' ? styles.tagBlue : styles.tagAmber, {alignSelf: 'flex-start', marginTop: 4}]}>
                    <Text style={styles.matTagText}>{mold.cutType === 'conjugado' ? 'Conjugado' : 'Individual'}</Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => openMoldModal(mold)}><Icon name="pencil-outline" size={18} color={Colors.zinc500} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => {setConfirmConfig({title: 'Excluir Molde', message: 'Excluir este molde?', onConfirm: async () => { await deleteDoc(doc(db, 'model_molds', mold.id)); Toast.show({type: 'success', text1: 'Molde excluído!'}); }}); setConfirmOpen(true);}}>
                    <Icon name="trash-can-outline" size={18} color={Colors.red500} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* COLOR MODAL */}
      <Modal visible={colorModal} animationType="slide" transparent onRequestClose={() => setColorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}><Text style={styles.modalTitle}>{editingColor ? 'Editar Cor' : 'Nova Cor'}</Text><TouchableOpacity onPress={() => setColorModal(false)}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity></View>
            <ScrollView>
              <TouchableOpacity style={styles.colorPickerBox} onPress={pickColorImage}>
                {colorPhoto ? <Image source={{uri: colorPhoto}} style={styles.colorPickerImg} /> : <View style={styles.colorPickerPlaceholder}><Icon name="camera-plus" size={28} color={Colors.zinc300} /></View>}
              </TouchableOpacity>
              <Text style={globalStyles.label}>Nome da Cor *</Text>
              <TextInput style={globalStyles.input} value={colorName} onChangeText={setColorName} placeholder="Ex: Preto/Branco" placeholderTextColor={Colors.zinc400} />
              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Observações</Text>
              <TextInput style={[globalStyles.input, {height: 70, textAlignVertical: 'top'}]} value={colorObs} onChangeText={setColorObs} placeholder="Detalhes..." placeholderTextColor={Colors.zinc400} multiline />
              <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Materiais</Text>
              {materials.map(mat => (
                <TouchableOpacity key={mat.id} style={styles.checkRow} onPress={() => setColorMaterials(prev => prev.includes(mat.id) ? prev.filter(id => id !== mat.id) : [...prev, mat.id])}>
                  <View style={[styles.checkbox, colorMaterials.includes(mat.id) && styles.checkboxChecked]}>
                    {colorMaterials.includes(mat.id) && <Icon name="check" size={14} color={Colors.white} />}
                  </View>
                  <Text style={styles.checkLabel}>{mat.name}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[globalStyles.secondaryButton, {flex: 1}]} onPress={() => setColorModal(false)}><Text style={globalStyles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[globalStyles.primaryButton, {flex: 1}]} onPress={saveColor} disabled={saving}>{saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar</Text>}</TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MATERIAL MODAL */}
      <Modal visible={materialModal} animationType="slide" transparent onRequestClose={() => setMaterialModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}><Text style={styles.modalTitle}>{editingMaterial ? 'Editar Material' : 'Novo Material'}</Text><TouchableOpacity onPress={() => setMaterialModal(false)}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity></View>
            <Text style={globalStyles.label}>Nome *</Text>
            <TextInput style={globalStyles.input} value={matName} onChangeText={setMatName} placeholder="Ex: Borracha Preta" placeholderTextColor={Colors.zinc400} />
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Tipo de Corte</Text>
            <View style={styles.segmented}>
              {(['conjugado', 'individual'] as const).map(ct => (
                <TouchableOpacity key={ct} style={[styles.segment, matCutType === ct && styles.segmentActive]} onPress={() => setMatCutType(ct)}>
                  <Text style={[styles.segmentText, matCutType === ct && {color: Colors.white}]}>{ct === 'conjugado' ? 'Conjugado (2/2)' : 'Individual (1/1)'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Observações</Text>
            <TextInput style={[globalStyles.input, {height: 70, textAlignVertical: 'top'}]} value={matObs} onChangeText={setMatObs} multiline placeholder="Detalhes..." placeholderTextColor={Colors.zinc400} />
            <View style={[styles.modalBtns, {marginTop: Spacing.xl}]}>
              <TouchableOpacity style={[globalStyles.secondaryButton, {flex: 1}]} onPress={() => setMaterialModal(false)}><Text style={globalStyles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[globalStyles.primaryButton, {flex: 1}]} onPress={saveMaterial} disabled={saving}>{saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MOLD MODAL */}
      <Modal visible={moldModal} animationType="slide" transparent onRequestClose={() => setMoldModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}><Text style={styles.modalTitle}>{editingMold ? 'Editar Molde' : 'Novo Molde'}</Text><TouchableOpacity onPress={() => setMoldModal(false)}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity></View>
            <Text style={globalStyles.label}>Nome *</Text>
            <TextInput style={globalStyles.input} value={moldName} onChangeText={setMoldName} placeholder="Ex: Faca do Cabedal" placeholderTextColor={Colors.zinc400} />
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Material Relacionado *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: Spacing.md}}>
              {materials.map(m => (
                <TouchableOpacity key={m.id} style={[styles.clientChip, moldMaterialId === m.id && styles.clientChipActive]} onPress={() => setMoldMaterialId(m.id)}>
                  <Text style={[styles.chipText, moldMaterialId === m.id && {color: Colors.white}]}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Tipo de Corte</Text>
            <View style={styles.segmented}>
              {(['conjugado', 'individual'] as const).map(ct => (
                <TouchableOpacity key={ct} style={[styles.segment, moldCutType === ct && styles.segmentActive]} onPress={() => setMoldCutType(ct)}>
                  <Text style={[styles.segmentText, moldCutType === ct && {color: Colors.white}]}>{ct === 'conjugado' ? 'Conjugado' : 'Individual'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.modalBtns, {marginTop: Spacing.xl}]}>
              <TouchableOpacity style={[globalStyles.secondaryButton, {flex: 1}]} onPress={() => setMoldModal(false)}><Text style={globalStyles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[globalStyles.primaryButton, {flex: 1}]} onPress={saveMold} disabled={saving}>{saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODEL EDIT MODAL */}
      <Modal visible={modelModal} animationType="slide" transparent onRequestClose={() => setModelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}><Text style={styles.modalTitle}>Editar Modelo</Text><TouchableOpacity onPress={() => setModelModal(false)}><Icon name="close" size={24} color={Colors.zinc600} /></TouchableOpacity></View>
            <Text style={globalStyles.label}>Nome *</Text>
            <TextInput style={globalStyles.input} value={modelName} onChangeText={setModelName} placeholderTextColor={Colors.zinc400} />
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Código *</Text>
            <TextInput style={globalStyles.input} value={modelCode} onChangeText={setModelCode} placeholderTextColor={Colors.zinc400} autoCapitalize="characters" />
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Valor (R$) *</Text>
            <TextInput style={globalStyles.input} value={modelValue} onChangeText={setModelValue} keyboardType="decimal-pad" placeholderTextColor={Colors.zinc400} />
            <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Descrição</Text>
            <TextInput style={[globalStyles.input, {height: 70, textAlignVertical: 'top'}]} value={modelDesc} onChangeText={setModelDesc} multiline placeholderTextColor={Colors.zinc400} />
            <View style={[styles.modalBtns, {marginTop: Spacing.xl}]}>
              <TouchableOpacity style={[globalStyles.secondaryButton, {flex: 1}]} onPress={() => setModelModal(false)}><Text style={globalStyles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[globalStyles.primaryButton, {flex: 1}]} onPress={saveModel} disabled={saving}>{saving ? <ActivityIndicator color={Colors.white} /> : <Text style={globalStyles.primaryButtonText}>Salvar</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal isOpen={confirmOpen} onClose={() => {setConfirmOpen(false); setConfirmConfig(null);}} onConfirm={confirmConfig?.onConfirm || (() => {})} title={confirmConfig?.title || ''} message={confirmConfig?.message || ''} confirmLabel="Excluir" />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.zinc100},
  backBtn: {padding: 8, marginRight: 8},
  headerTitle: {fontSize: 18, fontWeight: '700', color: Colors.zinc900},
  headerSub: {fontSize: 13, color: Colors.zinc500, marginTop: 2},
  tabBar: {backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.zinc100, maxHeight: 52},
  tab: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12},
  tabActive: {backgroundColor: Colors.zinc100},
  tabText: {fontSize: 13, fontWeight: '600', color: Colors.zinc500},
  tabTextActive: {color: Colors.zinc900},
  content: {padding: Spacing.xl, paddingBottom: 40},
  sectionHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg},
  sectionTitle: {fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  editBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.zinc100, borderRadius: Radius.lg},
  editBtnText: {fontSize: 12, fontWeight: '700', color: Colors.zinc600},
  modelImage: {width: '100%', height: 200, borderRadius: Radius.xl, marginBottom: Spacing.lg},
  infoRow: {backgroundColor: Colors.zinc50, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: 8},
  infoLabel: {fontSize: 11, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', marginBottom: 4},
  infoValue: {fontSize: 15, fontWeight: '700', color: Colors.zinc900},
  colorHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  colorThumb: {width: 44, height: 44, backgroundColor: Colors.zinc100, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  colorThumbImg: {width: '100%', height: '100%'},
  colorName: {fontSize: 15, fontWeight: '700', color: Colors.zinc900},
  colorSub: {fontSize: 12, color: Colors.zinc500, marginTop: 2},
  matChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6},
  matChip: {backgroundColor: Colors.zinc100, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  matChipText: {fontSize: 10, fontWeight: '700', color: Colors.zinc600},
  itemActions: {flexDirection: 'row', gap: 8},
  matName: {fontSize: 15, fontWeight: '700', color: Colors.zinc900},
  matTagRow: {flexDirection: 'row', gap: 6, marginTop: 4},
  matTag: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full},
  tagBlue: {backgroundColor: Colors.blue50},
  tagAmber: {backgroundColor: Colors.amber50},
  matTagText: {fontSize: 10, fontWeight: '700', color: Colors.zinc600},
  moldMatName: {fontSize: 12, color: Colors.zinc500, marginTop: 2},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end'},
  modalBox: {backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xxl, maxHeight: '90%'},
  modalHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl},
  modalTitle: {fontSize: 18, fontWeight: '700', color: Colors.zinc900},
  colorPickerBox: {alignSelf: 'center', marginBottom: Spacing.xl},
  colorPickerImg: {width: 100, height: 100, borderRadius: 16},
  colorPickerPlaceholder: {width: 100, height: 100, backgroundColor: Colors.zinc100, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  checkRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  checkbox: {width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: Colors.zinc300, alignItems: 'center', justifyContent: 'center'},
  checkboxChecked: {backgroundColor: Colors.zinc900, borderColor: Colors.zinc900},
  checkLabel: {fontSize: 14, color: Colors.zinc700},
  segmented: {flexDirection: 'row', gap: 8, marginTop: 4},
  segment: {flex: 1, paddingVertical: 12, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.zinc200, alignItems: 'center'},
  segmentActive: {backgroundColor: Colors.zinc900, borderColor: Colors.zinc900},
  segmentText: {fontSize: 13, fontWeight: '700', color: Colors.zinc500},
  clientChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.zinc100, marginRight: 8},
  clientChipActive: {backgroundColor: Colors.zinc900},
  chipText: {fontSize: 13, fontWeight: '600', color: Colors.zinc600},
  modalBtns: {flexDirection: 'row', gap: 12},
});
