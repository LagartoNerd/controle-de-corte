import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  collection, query, where, getDocs, getDoc, doc,
  writeBatch, increment, serverTimestamp,
} from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {format} from 'date-fns';
import {db, auth} from '../firebase';
import {
  Model, ModelColor, ModelMaterial, ModelMold, Client,
  GradeType, GradeQuantities, ALL_SIZES, STANDARD_GRADES, CONJUGATED_PAIRS,, AppNavigation} from '../types';
import {getFortnightId, getFortnightInfo, formatCurrency} from '../utils/fortnight';
import {handleFirestoreError, OperationType} from '../utils/error';
import {ConfirmModal} from '../components/ConfirmModal';
import {Colors, Radius, Spacing, globalStyles} from '../theme';

interface GradeEntry {
  id: string;
  gradeType: GradeType;
  customGrade: GradeQuantities;
  quantity: string;
}

interface ItemColorEntry {
  id: string;
  colorId: string;
  color?: ModelColor;
  grades: GradeEntry[];
}

interface ItemEntry {
  id: string;
  modelId: string;
  colors: ItemColorEntry[];
  model?: Model;
  modelMaterials: ModelMaterial[];
  modelMolds: ModelMold[];
}

function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

export function DailySheetFormScreen({route, navigation}: {route: {params: Record<string, any>}; navigation: AppNavigation}) {
  const sheetId = route?.params?.sheetId;
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modelColors, setModelColors] = useState<ModelColor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const fetchData = async () => {
      try {
        const [clientsSnap, modelsSnap, colorsSnap] = await Promise.all([
          getDocs(query(collection(db, 'clients'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'models'), where('userId', '==', uid), where('status', '==', 'active'))),
          getDocs(query(collection(db, 'model_colors'), where('userId', '==', uid), where('status', '==', 'active'))),
        ]);

        const clientsData: Client[] = [];
        clientsSnap.forEach(d => clientsData.push({id: d.id, ...d.data()} as Client));
        setClients(clientsData.sort((a, b) => a.name.localeCompare(b.name)));

        const modelsData: Model[] = [];
        modelsSnap.forEach(d => modelsData.push({id: d.id, ...d.data()} as Model));
        setModels(modelsData);

        const colorsData: ModelColor[] = [];
        colorsSnap.forEach(d => colorsData.push({id: d.id, ...d.data()} as ModelColor));
        setModelColors(colorsData);

        if (sheetId) {
          const sheetSnap = await getDoc(doc(db, 'daily_sheets', sheetId));
          if (sheetSnap.exists()) {
            const sheetData = sheetSnap.data();
            setDate(new Date(sheetData.date + 'T12:00:00'));
            setClientId(sheetData.clientId);

            const itemsSnap = await getDocs(
              query(collection(db, 'daily_sheet_items'), where('sheetId', '==', sheetId)),
            );
            const map: {[modelId: string]: ItemEntry} = {};

            for (const d of itemsSnap.docs) {
              const data = d.data();
              if (!map[data.modelId]) {
                const model = modelsData.find(m => m.id === data.modelId);
                const [matSnap, moldSnap] = await Promise.all([
                  getDocs(query(collection(db, 'model_materials'), where('modelId', '==', data.modelId))),
                  getDocs(query(collection(db, 'model_molds'), where('modelId', '==', data.modelId))),
                ]);
                map[data.modelId] = {
                  id: randomId(), modelId: data.modelId, colors: [], model,
                  modelMaterials: matSnap.docs.map(d => ({id: d.id, ...d.data()} as ModelMaterial)),
                  modelMolds: moldSnap.docs.map(d => ({id: d.id, ...d.data()} as ModelMold)),
                };
              }
              const entry = map[data.modelId];
              let colorEntry = entry.colors.find(c => c.colorId === data.colorId);
              if (!colorEntry) {
                const color = colorsData.find(c => c.id === data.colorId);
                colorEntry = {id: randomId(), colorId: data.colorId, color, grades: []};
                entry.colors.push(colorEntry);
              }
              colorEntry.grades.push({
                id: d.id, gradeType: data.gradeType,
                customGrade: data.customGrade || Object.fromEntries(ALL_SIZES.map(s => [s, 0])),
                quantity: String(data.quantity),
              });
            }
            setItems(Object.values(map));
          }
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'daily_sheet_form/init');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sheetId]);

  const filteredModels = clientId ? models.filter(m => m.clientId === clientId) : models;

  const handleClientChange = (newClientId: string) => {
    if (newClientId === clientId) return;
    if (items.length > 0) {
      setPendingClientId(newClientId);
      setConfirmOpen(true);
    } else {
      setClientId(newClientId);
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, {id: randomId(), modelId: '', colors: [], modelMaterials: [], modelMolds: []}]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItemModel = async (itemId: string, modelId: string) => {
    const model = models.find(m => m.id === modelId);
    const [matSnap, moldSnap] = await Promise.all([
      getDocs(query(collection(db, 'model_materials'), where('modelId', '==', modelId))),
      getDocs(query(collection(db, 'model_molds'), where('modelId', '==', modelId))),
    ]);
    setItems(prev => prev.map(i =>
      i.id === itemId ? {
        ...i, modelId, model, colors: [],
        modelMaterials: matSnap.docs.map(d => ({id: d.id, ...d.data()} as ModelMaterial)),
        modelMolds: moldSnap.docs.map(d => ({id: d.id, ...d.data()} as ModelMold)),
      } : i,
    ));
    if (model && !clientId) setClientId(model.clientId);
  };

  const addColor = (itemId: string, color: ModelColor) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      if (i.colors.some(c => c.colorId === color.id)) {
        Toast.show({type: 'error', text1: 'Cor já adicionada.'}); return i;
      }
      return {
        ...i, colors: [...i.colors, {
          id: randomId(), colorId: color.id, color,
          grades: [{id: randomId(), gradeType: 'standard_high', customGrade: Object.fromEntries(ALL_SIZES.map(s => [s, 0])), quantity: ''}],
        }],
      };
    }));
  };

  const removeColor = (itemId: string, colorEntryId: string) =>
    setItems(prev => prev.map(i => i.id === itemId ? {...i, colors: i.colors.filter(c => c.id !== colorEntryId)} : i));

  const addGrade = (itemId: string, colorEntryId: string) =>
    setItems(prev => prev.map(i => i.id !== itemId ? i : {
      ...i, colors: i.colors.map(c => c.id !== colorEntryId ? c : {
        ...c, grades: [...c.grades, {id: randomId(), gradeType: 'standard_high', customGrade: Object.fromEntries(ALL_SIZES.map(s => [s, 0])), quantity: ''}],
      }),
    }));

  const removeGrade = (itemId: string, colorEntryId: string, gradeId: string) =>
    setItems(prev => prev.map(i => i.id !== itemId ? i : {
      ...i, colors: i.colors.map(c => c.id !== colorEntryId ? c : {
        ...c, grades: c.grades.filter(g => g.id !== gradeId),
      }).filter(c => c.grades.length > 0),
    }));

  const updateGrade = (itemId: string, colorEntryId: string, gradeId: string, updates: Partial<GradeEntry>) =>
    setItems(prev => prev.map(i => i.id !== itemId ? i : {
      ...i, colors: i.colors.map(c => c.id !== colorEntryId ? c : {
        ...c, grades: c.grades.map(g => g.id !== gradeId ? g : {...g, ...updates}),
      }),
    }));

  const getGradePairs = (grade: GradeEntry) => {
    const qty = parseInt(grade.quantity) || 0;
    const gradeMap = grade.gradeType === 'custom' ? grade.customGrade
      : STANDARD_GRADES[grade.gradeType === 'standard_high' ? 'high' : 'low'];
    return Object.values(gradeMap).reduce((a, b) => a + b, 0) * qty;
  };

  const calculateTotals = () => {
    let totalPairs = 0, totalValue = 0;
    items.forEach(item => {
      item.colors.forEach(ce => {
        ce.grades.forEach(grade => {
          const pairs = getGradePairs(grade);
          totalPairs += pairs;
          totalValue += pairs * (item.model?.unitValue || 0);
        });
      });
    });
    return {totalPairs, totalValue};
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    if (!clientId) return Toast.show({type: 'error', text1: 'Selecione um cliente.'});
    if (items.length === 0) return Toast.show({type: 'error', text1: 'Adicione pelo menos um modelo.'});
    if (items.some(i => !i.modelId || i.colors.length === 0))
      return Toast.show({type: 'error', text1: 'Preencha modelo e pelo menos uma cor em todos os itens.'});
    for (const item of items) {
      for (const color of item.colors) {
        if (color.grades.some(g => !g.quantity || parseInt(g.quantity) <= 0))
          return Toast.show({type: 'error', text1: `Informe a quantidade das grades da cor ${color.color?.name}.`});
      }
    }

    setSaving(true);
    const batch = writeBatch(db);
    const {totalPairs, totalValue} = calculateTotals();
    const dateStr = format(date, 'yyyy-MM-dd');
    const sheetDate = new Date(dateStr + 'T12:00:00');
    const fId = getFortnightId(sheetDate, auth.currentUser.uid, clientId);
    const fInfo = getFortnightInfo(sheetDate);
    const client = clients.find(c => c.id === clientId);

    try {
      const fRef = doc(db, 'fortnights', fId);
      const fSnap = await getDoc(fRef);
      if (!fSnap.exists()) {
        batch.set(fRef, {userId: auth.currentUser.uid, clientId, clientName: client?.name || '', year: fInfo.year, month: fInfo.month, period: fInfo.period, totalPairs, totalValue, paidValue: 0, status: 'not_paid'});
      } else {
        batch.update(fRef, {totalPairs: increment(totalPairs), totalValue: increment(totalValue), clientName: client?.name || ''});
      }

      const sheetRef = doc(collection(db, 'daily_sheets'));
      batch.set(sheetRef, {userId: auth.currentUser.uid, clientId, clientName: client?.name || '', date: dateStr, fortnightId: fId, totalPairs, totalValue, createdAt: serverTimestamp()});

      items.forEach(item => {
        item.colors.forEach(ce => {
          ce.grades.forEach(grade => {
            const qty = parseInt(grade.quantity);
            const gradeMap = grade.gradeType === 'custom' ? grade.customGrade : STANDARD_GRADES[grade.gradeType === 'standard_high' ? 'high' : 'low'];
            const itemPairs = Object.values(gradeMap).reduce((a, b) => a + b, 0) * qty;
            const itemRef = doc(collection(db, 'daily_sheet_items'));
            batch.set(itemRef, {
              sheetId: sheetRef.id, userId: auth.currentUser!.uid, clientId,
              modelId: item.modelId, colorId: ce.colorId, gradeType: grade.gradeType,
              customGrade: grade.gradeType === 'custom' ? grade.customGrade : null,
              quantity: qty, totalPairs: itemPairs,
              unitValue: item.model?.unitValue || 0, totalValue: itemPairs * (item.model?.unitValue || 0),
            });
          });
        });
      });

      await batch.commit();
      Toast.show({type: 'success', text1: 'Ficha salva com sucesso!'});
      navigation.goBack();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'daily_sheets/batch');
    } finally {
      setSaving(false);
    }
  };

  // Consolidated materials/molds for preview
  const getConsolidatedMaterials = () => {
    const cons: {[key: string]: {material: ModelMaterial; quantities: GradeQuantities}} = {};
    items.forEach(item => {
      item.colors.forEach(ce => {
        const color = ce.color;
        if (!color) return;
        const colorMats = item.modelMaterials.filter(m => color.materialIds?.includes(m.id));
        ce.grades.forEach(grade => {
          const qty = parseInt(grade.quantity) || 0;
          const gradeQ = grade.gradeType === 'custom' ? grade.customGrade : STANDARD_GRADES[grade.gradeType === 'standard_high' ? 'high' : 'low'];
          colorMats.forEach(mat => {
            const key = `${mat.name}_${mat.cutType}`;
            if (!cons[key]) cons[key] = {material: mat, quantities: Object.fromEntries(ALL_SIZES.map(s => [s, 0]))};
            ALL_SIZES.forEach(s => {
              const pairs = (gradeQ[s] || 0) * qty;
              cons[key].quantities[s] += mat.cutType === 'individual' ? pairs * 2 : pairs;
            });
          });
        });
      });
    });
    return Object.values(cons);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.zinc900} /></View>;

  const {totalPairs, totalValue} = calculateTotals();

  return (
    <View style={globalStyles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.zinc900} />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>Ficha do Dia</Text>
          <Text style={styles.headerSub}>Monte a produção diária</Text>
        </View>
        <TouchableOpacity style={styles.previewBtn} onPress={() => setShowPreview(!showPreview)}>
          <Icon name={showPreview ? 'pencil' : 'file-document-outline'} size={18} color={Colors.zinc900} />
          <Text style={styles.previewBtnText}>{showPreview ? 'Editar' : 'Resumo'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Date + Client */}
        <View style={globalStyles.card}>
          <View style={styles.dateClientRow}>
            <View style={{flex: 1}}>
              <Text style={globalStyles.label}>Data da Produção</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Icon name="calendar" size={18} color={Colors.zinc500} />
                <Text style={styles.dateBtnText}>{format(date, 'dd/MM/yyyy')}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {setShowDatePicker(false); if (d) setDate(d);}}
                />
              )}
            </View>
          </View>

          <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Cliente / Fábrica</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 0}}>
            {clients.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.clientChip, clientId === c.id && styles.clientChipActive]}
                onPress={() => handleClientChange(c.id)}>
                <Text style={[styles.clientChipText, clientId === c.id && {color: Colors.white}]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total Estimado</Text>
            <Text style={styles.totalsValue}>
              R$ {formatCurrency(totalValue)}
            </Text>
            <Text style={styles.totalsSubValue}>{totalPairs} pares</Text>
          </View>
        </View>

        {!showPreview ? (
          <>
            {items.map((item, index) => (
              <View key={item.id} style={[globalStyles.card, {marginTop: 12}]}>
                {/* Item header */}
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Modelo #{index + 1}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Icon name="trash-can-outline" size={20} color={Colors.red500} />
                  </TouchableOpacity>
                </View>

                {/* Model selector */}
                <Text style={globalStyles.label}>Modelo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: Spacing.lg}}>
                  {filteredModels.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.modelChip, item.modelId === m.id && styles.modelChipActive]}
                      onPress={() => updateItemModel(item.id, m.id)}>
                      <Text style={[styles.modelChipText, item.modelId === m.id && {color: Colors.white}]}>{m.name}</Text>
                      <Text style={[styles.modelChipCode, item.modelId === m.id && {color: 'rgba(255,255,255,0.6)'}]}>{m.code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {item.modelId && (
                  <>
                    {/* Color entries */}
                    {item.colors.map(ce => (
                      <View key={ce.id} style={styles.colorEntry}>
                        <View style={styles.colorEntryHeader}>
                          <Text style={styles.colorEntryName}>{ce.color?.name}</Text>
                          <View style={styles.colorEntryActions}>
                            <TouchableOpacity style={styles.smallBtn} onPress={() => addGrade(item.id, ce.id)}>
                              <Icon name="plus" size={14} color={Colors.white} />
                              <Text style={styles.smallBtnText}>Grade</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeColor(item.id, ce.id)}>
                              <Icon name="trash-can-outline" size={18} color={Colors.red500} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {ce.grades.map((grade, gi) => (
                          <View key={grade.id} style={styles.gradeBox}>
                            <View style={styles.gradeBoxHeader}>
                              <Text style={styles.gradeLabel}>Grade #{gi + 1}</Text>
                              {ce.grades.length > 1 && (
                                <TouchableOpacity onPress={() => removeGrade(item.id, ce.id, grade.id)}>
                                  <Icon name="close" size={16} color={Colors.zinc400} />
                                </TouchableOpacity>
                              )}
                            </View>
                            {/* Grade type selector */}
                            <View style={styles.gradeTypeRow}>
                              {(['standard_high', 'standard_low', 'custom'] as GradeType[]).map(t => (
                                <TouchableOpacity
                                  key={t}
                                  style={[styles.gradeTypeBtn, grade.gradeType === t && styles.gradeTypeBtnActive]}
                                  onPress={() => updateGrade(item.id, ce.id, grade.id, {gradeType: t})}>
                                  <Text style={[styles.gradeTypeBtnText, grade.gradeType === t && {color: Colors.white}]}>
                                    {t === 'standard_high' ? 'Alta' : t === 'standard_low' ? 'Baixa' : 'Pers.'}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            {/* Quantity */}
                            <View style={styles.qtyRow}>
                              <View style={{flex: 1}}>
                                <Text style={styles.qtyLabel}>Qtd. Grades</Text>
                                <TextInput
                                  style={styles.qtyInput}
                                  value={grade.quantity}
                                  onChangeText={v => updateGrade(item.id, ce.id, grade.id, {quantity: v})}
                                  keyboardType="number-pad"
                                  placeholder="Ex: 1"
                                  placeholderTextColor={Colors.zinc400}
                                />
                              </View>
                              <View style={styles.pairsBox}>
                                <Text style={styles.qtyLabel}>Total Pares</Text>
                                <Text style={styles.pairsCount}>{getGradePairs(grade)}</Text>
                              </View>
                            </View>
                            {/* Custom grade inputs */}
                            {grade.gradeType === 'custom' && (
                              <View style={styles.customGradeGrid}>
                                {ALL_SIZES.map(size => (
                                  <View key={size} style={styles.customSizeBox}>
                                    <Text style={styles.customSizeLabel}>{size}</Text>
                                    <TextInput
                                      style={styles.customSizeInput}
                                      value={String(grade.customGrade[size] || 0)}
                                      onChangeText={v => updateGrade(item.id, ce.id, grade.id, {customGrade: {...grade.customGrade, [size]: Math.max(0, parseInt(v) || 0)}})}
                                      keyboardType="number-pad"
                                    />
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    ))}

                    {/* Available colors */}
                    <Text style={[globalStyles.label, {marginTop: Spacing.lg}]}>Cores Disponíveis</Text>
                    <View style={styles.availableColors}>
                      {modelColors.filter(c => c.modelId === item.modelId).map(color => (
                        <TouchableOpacity key={color.id} style={styles.availableColorBtn} onPress={() => addColor(item.id, color)}>
                          <Text style={styles.availableColorName}>{color.name}</Text>
                          <Icon name="plus" size={14} color={Colors.zinc500} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Icon name="plus-circle-outline" size={28} color={Colors.zinc400} />
              <Text style={styles.addItemText}>Adicionar Modelo à Ficha</Text>
            </TouchableOpacity>
          </>
        ) : (
          // PREVIEW
          <View style={globalStyles.card}>
            <Text style={styles.previewTitle}>Resumo do Corte do Dia</Text>
            <Text style={styles.previewDate}>{format(date, 'dd/MM/yyyy')}</Text>

            {getConsolidatedMaterials().filter(m => m.material.cutType === 'conjugado').length > 0 && (
              <>
                <Text style={styles.previewSection}>Materiais Conjugados (2 em 2)</Text>
                {getConsolidatedMaterials().filter(m => m.material.cutType === 'conjugado').map((m, i) => (
                  <View key={i} style={styles.previewMaterialCard}>
                    <Text style={styles.previewMaterialName}>{m.material.name}</Text>
                    <View style={styles.previewSizesRow}>
                      {CONJUGATED_PAIRS.map(([s1, s2]) => {
                        const total = (m.quantities[s1] || 0) + (m.quantities[s2] || 0);
                        return (
                          <View key={`${s1}-${s2}`} style={styles.previewSizeBox}>
                            <Text style={styles.previewSizeLabel}>{s1}/{s2}</Text>
                            <Text style={styles.previewSizeValue}>{total}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            )}

            {getConsolidatedMaterials().filter(m => m.material.cutType === 'individual').length > 0 && (
              <>
                <Text style={styles.previewSection}>Materiais Individuais (1 em 1)</Text>
                {getConsolidatedMaterials().filter(m => m.material.cutType === 'individual').map((m, i) => (
                  <View key={i} style={styles.previewMaterialCard}>
                    <Text style={styles.previewMaterialName}>{m.material.name}</Text>
                    <View style={styles.previewSizesRow}>
                      {ALL_SIZES.map(size => (
                        <View key={size} style={styles.previewSizeBox}>
                          <Text style={styles.previewSizeLabel}>{size}</Text>
                          <Text style={styles.previewSizeValue}>{m.quantities[size] || 0}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}

            <View style={styles.previewTotals}>
              <View>
                <Text style={styles.previewTotalsLabel}>Total de Pares</Text>
                <Text style={styles.previewTotalsValue}>{totalPairs}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.previewTotalsLabel}>Valor Total</Text>
                <Text style={[styles.previewTotalsValue, {color: Colors.emerald600}]}>
                  R$ {formatCurrency(totalValue)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.bottomCancelBtn]} onPress={() => navigation.goBack()}>
          <Text style={styles.bottomCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomSaveBtn, (saving || items.length === 0) && {opacity: 0.5}]}
          onPress={handleSubmit}
          disabled={saving || items.length === 0}>
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Icon name="content-save-outline" size={20} color={Colors.white} />
              <Text style={styles.bottomSaveText}>Finalizar Ficha</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {setConfirmOpen(false); setPendingClientId(null);}}
        onConfirm={() => {
          if (pendingClientId) { setClientId(pendingClientId); setItems([]); setPendingClientId(null); }
        }}
        title="Alterar Cliente?"
        message="Alterar o cliente removerá todos os modelos desta ficha. Deseja continuar?"
        confirmLabel="Sim, Alterar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.zinc100},
  backBtn: {padding: 8, marginRight: 8},
  headerTitle: {fontSize: 18, fontWeight: '700', color: Colors.zinc900},
  headerSub: {fontSize: 13, color: Colors.zinc500},
  previewBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, backgroundColor: Colors.zinc100, borderRadius: Radius.lg},
  previewBtnText: {fontSize: 12, fontWeight: '700', color: Colors.zinc700},
  content: {padding: Spacing.xl, paddingBottom: 120},
  dateClientRow: {marginBottom: Spacing.lg},
  dateBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.zinc50, borderWidth: 1, borderColor: Colors.zinc200, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 12},
  dateBtnText: {fontSize: 15, color: Colors.zinc900, fontWeight: '600'},
  clientChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.zinc100, marginRight: 8},
  clientChipActive: {backgroundColor: Colors.zinc900},
  clientChipText: {fontSize: 13, fontWeight: '600', color: Colors.zinc600},
  totalsRow: {marginTop: Spacing.lg, alignItems: 'flex-end'},
  totalsLabel: {fontSize: 11, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase'},
  totalsValue: {fontSize: 22, fontWeight: '900', color: Colors.zinc900},
  totalsSubValue: {fontSize: 13, color: Colors.zinc500},
  itemHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg},
  itemTitle: {fontSize: 15, fontWeight: '700', color: Colors.zinc900},
  modelChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.xl, backgroundColor: Colors.zinc100, marginRight: 8, alignItems: 'center'},
  modelChipActive: {backgroundColor: Colors.zinc900},
  modelChipText: {fontSize: 13, fontWeight: '700', color: Colors.zinc600},
  modelChipCode: {fontSize: 10, color: Colors.zinc400, marginTop: 2},
  colorEntry: {backgroundColor: Colors.zinc50, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.zinc200},
  colorEntryHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md},
  colorEntryName: {fontSize: 14, fontWeight: '700', color: Colors.zinc900},
  colorEntryActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  smallBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.zinc900, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 5},
  smallBtnText: {fontSize: 11, fontWeight: '700', color: Colors.white},
  gradeBox: {backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.zinc200},
  gradeBoxHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm},
  gradeLabel: {fontSize: 11, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase'},
  gradeTypeRow: {flexDirection: 'row', gap: 6, marginBottom: Spacing.sm},
  gradeTypeBtn: {flex: 1, paddingVertical: 7, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.zinc200, alignItems: 'center'},
  gradeTypeBtnActive: {backgroundColor: Colors.zinc900, borderColor: Colors.zinc900},
  gradeTypeBtnText: {fontSize: 11, fontWeight: '700', color: Colors.zinc500},
  qtyRow: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  qtyLabel: {fontSize: 10, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', marginBottom: 4},
  qtyInput: {backgroundColor: Colors.zinc50, borderWidth: 1, borderColor: Colors.zinc200, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  pairsBox: {backgroundColor: Colors.zinc50, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', minWidth: 70},
  pairsCount: {fontSize: 18, fontWeight: '900', color: Colors.zinc900},
  customGradeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm},
  customSizeBox: {alignItems: 'center', width: '18%'},
  customSizeLabel: {fontSize: 10, fontWeight: '700', color: Colors.zinc400, marginBottom: 4},
  customSizeInput: {width: '100%', backgroundColor: Colors.zinc50, borderWidth: 1, borderColor: Colors.zinc200, borderRadius: 8, padding: 4, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.zinc900},
  availableColors: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  availableColorBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.zinc200},
  availableColorName: {fontSize: 12, fontWeight: '700', color: Colors.zinc700},
  addItemBtn: {alignItems: 'center', padding: Spacing.xxl, borderRadius: Radius.xxl, borderWidth: 2, borderColor: Colors.zinc200, borderStyle: 'dashed', marginTop: 12},
  addItemText: {fontSize: 14, fontWeight: '700', color: Colors.zinc400, marginTop: 8},
  previewTitle: {fontSize: 16, fontWeight: '900', color: Colors.zinc900, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4},
  previewDate: {fontSize: 13, color: Colors.zinc500, textAlign: 'center', marginBottom: Spacing.xl},
  previewSection: {fontSize: 12, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm},
  previewMaterialCard: {backgroundColor: Colors.zinc50, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: 8},
  previewMaterialName: {fontSize: 14, fontWeight: '700', color: Colors.zinc900, marginBottom: 10},
  previewSizesRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  previewSizeBox: {alignItems: 'center', minWidth: 44},
  previewSizeLabel: {fontSize: 10, fontWeight: '700', color: Colors.zinc400},
  previewSizeValue: {fontSize: 18, fontWeight: '900', color: Colors.zinc900},
  previewTotals: {flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.zinc100},
  previewTotalsLabel: {fontSize: 11, fontWeight: '700', color: Colors.zinc400, textTransform: 'uppercase'},
  previewTotalsValue: {fontSize: 24, fontWeight: '900', color: Colors.zinc900},
  bottomBar: {position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: Spacing.xl, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: Colors.zinc100},
  bottomCancelBtn: {flex: 1, paddingVertical: 16, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.zinc200, alignItems: 'center'},
  bottomCancelText: {fontWeight: '700', color: Colors.zinc700},
  bottomSaveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.xl, backgroundColor: Colors.zinc900},
  bottomSaveText: {fontWeight: '700', color: Colors.white, fontSize: 15},
});
