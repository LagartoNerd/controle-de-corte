import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, Radius, Spacing} from '../theme';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDanger = true,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.container}>
          <View style={[styles.iconBox, isDanger ? styles.dangerIcon : styles.neutralIcon]}>
            <Icon
              name="alert-triangle"
              size={32}
              color={isDanger ? Colors.red600 : Colors.zinc600}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, isDanger ? styles.dangerBtn : styles.neutralBtn]}
              onPress={() => {
                onConfirm();
                onClose();
              }}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  container: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.xxl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  dangerIcon: {backgroundColor: Colors.red50},
  neutralIcon: {backgroundColor: Colors.zinc100},
  title: {fontSize: 18, fontWeight: '700', color: Colors.zinc900, marginBottom: 8, textAlign: 'center'},
  message: {fontSize: 14, color: Colors.zinc500, textAlign: 'center', marginBottom: Spacing.xxl, lineHeight: 20},
  buttons: {flexDirection: 'row', gap: 12, width: '100%'},
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.zinc200,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {fontWeight: '700', color: Colors.zinc600},
  confirmBtn: {flex: 1, borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center'},
  dangerBtn: {backgroundColor: Colors.red600},
  neutralBtn: {backgroundColor: Colors.zinc900},
  confirmText: {fontWeight: '700', color: Colors.white},
});
