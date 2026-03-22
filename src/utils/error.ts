import {auth} from '../firebase';
import Toast from 'react-native-toast-message';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo = {
    error: message,
    operationType,
    path,
    userId: auth.currentUser?.uid,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  Toast.show({type: 'error', text1: 'Erro ao salvar', text2: message});
  throw new Error(JSON.stringify(errInfo));
}
