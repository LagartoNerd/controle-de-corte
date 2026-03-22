import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {LinkingOptions} from '@react-navigation/native';
import {User, signOut} from 'firebase/auth';
import {auth} from '../firebase';
import {UserProfile, RootStackParamList, DrawerParamList} from '../types';
import {Colors, Spacing, Radius} from '../theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {AuthScreen} from '../screens/AuthScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {ClientsScreen} from '../screens/ClientsScreen';
import {ClientFinanceScreen} from '../screens/ClientFinanceScreen';
import {ModelsScreen} from '../screens/ModelsScreen';
import {ModelDetailsScreen} from '../screens/ModelDetailsScreen';
import {DailySheetsListScreen} from '../screens/DailySheetsListScreen';
import {DailySheetFormScreen} from '../screens/DailySheetFormScreen';
import {FortnightDetailsScreen} from '../screens/FortnightDetailsScreen';
import {ReportsScreen} from '../screens/ReportsScreen';
import {PricingScreen, AdminUsersScreen, AdminConfigScreen} from '../screens/PricingScreen';
import {CheckoutScreen} from '../screens/CheckoutScreenReal';

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

interface Props {
  user: User | null;
  profile: UserProfile | null;
}

// ── Deep link config ──────────────────────────────────────────────────────────
// Mapeia controlecorte://payment/success → tela Checkout (tratado no CheckoutScreenReal)
// Mapeia controlecorte://payment/failure → tela Pricing
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['controlecorte://', 'https://controlecorte.app'],
  config: {
    screens: {
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Pricing: 'pricing',
        },
      },
      Checkout: 'payment/checkout',
      // success/failure são tratados via Linking.addEventListener no CheckoutScreenReal
    },
  },
};

// ── Custom Drawer ─────────────────────────────────────────────────────────────
function CustomDrawerContent(
  props: DrawerContentComponentProps & {profile: UserProfile | null},
) {
  const {profile} = props;
  const effectivePlan = profile?.trialStartDate ? profile.trialPlan : profile?.plan;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <View style={styles.drawerLogoBox}>
          <Text style={styles.drawerLogoText}>C</Text>
        </View>
        <View>
          <Text style={styles.drawerTitle}>Controle de Corte</Text>
          <Text style={styles.drawerSubtitle}>Setor Calçadista</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <DrawerItemList {...props} />

      <View style={styles.drawerFooter}>
        {profile?.trialStartDate && (
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeTitle}>Teste Grátis Ativo</Text>
            <Text style={styles.trialBadgeText}>
              Plano: {profile.trialPlan?.toUpperCase()}
            </Text>
            <Text style={styles.trialBadgeHint}>
              Cobrança automática em 15 dias.
            </Text>
          </View>
        )}
        <View style={styles.planRow}>
          <Icon
            name="crown"
            size={16}
            color={effectivePlan !== 'free' ? Colors.amber500 : Colors.zinc400}
          />
          <Text style={styles.planText}>
            {(effectivePlan || 'free').toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => signOut(auth)}>
          <Icon name="logout" size={20} color={Colors.red600} />
          <Text style={styles.signOutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

// ── Drawer navigator ──────────────────────────────────────────────────────────
function MainDrawer({profile}: {profile: UserProfile | null}) {
  return (
    <Drawer.Navigator
      drawerContent={props => (
        <CustomDrawerContent {...props} profile={profile} />
      )}
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.white,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: Colors.zinc900,
        headerTitleStyle: {fontWeight: '700'},
        drawerStyle: {backgroundColor: Colors.white, width: 260},
        drawerActiveTintColor: Colors.zinc900,
        drawerInactiveTintColor: Colors.zinc500,
        drawerActiveBackgroundColor: Colors.zinc100,
        drawerItemStyle: {borderRadius: Radius.xl, marginHorizontal: 8},
        drawerLabelStyle: {fontWeight: '700', fontSize: 14},
      }}>
      <Drawer.Screen
        name="Dashboard"
        options={{title: 'Dashboard', drawerIcon: ({color}) => <Icon name="view-dashboard" size={22} color={color} />}}>
        {props => <DashboardScreen {...props} profile={profile} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="Clients"
        options={{title: 'Clientes', drawerIcon: ({color}) => <Icon name="account-group" size={22} color={color} />}}>
        {props => <ClientsScreen {...props} profile={profile} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="ClientFinance"
        options={{title: 'Financeiro', drawerIcon: ({color}) => <Icon name="currency-usd" size={22} color={color} />}}>
        {props => <ClientFinanceScreen {...props} profile={profile} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="Models"
        options={{title: 'Modelos', drawerIcon: ({color}) => <Icon name="shoe-sneaker" size={22} color={color} />}}>
        {props => <ModelsScreen {...props} profile={profile} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="DailySheets"
        options={{title: 'Fichas do Dia', drawerIcon: ({color}) => <Icon name="clipboard-list" size={22} color={color} />}}>
        {props => <DailySheetsListScreen {...props} profile={profile} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="Reports"
        options={{title: 'Relatórios', drawerIcon: ({color}) => <Icon name="chart-bar" size={22} color={color} />}}>
        {props => <ReportsScreen {...props} profile={profile} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="Pricing"
        options={{
          title: 'Planos',
          drawerIcon: () => <Icon name="crown" size={22} color={Colors.amber500} />,
          drawerLabelStyle: {fontWeight: '700', fontSize: 14, color: Colors.amber600},
        }}>
        {props => <PricingScreen {...props} profile={profile} />}
      </Drawer.Screen>

      {profile?.role === 'admin' && (
        <>
          <Drawer.Screen
            name="AdminUsers"
            options={{
              title: 'Usuários',
              drawerIcon: () => <Icon name="account-cog" size={22} color="#9333ea" />,
            }}
            component={AdminUsersScreen}
          />
          <Drawer.Screen
            name="AdminConfig"
            options={{
              title: 'Configurações',
              drawerIcon: () => <Icon name="cog" size={22} color="#9333ea" />,
            }}
            component={AdminConfigScreen}
          />
        </>
      )}
    </Drawer.Navigator>
  );
}

// ── Root Stack ────────────────────────────────────────────────────────────────
export function AppNavigator({user, profile}: Props) {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Main">
            {() => <MainDrawer profile={profile} />}
          </Stack.Screen>
          <Stack.Screen name="ModelDetails" component={ModelDetailsScreen} />
          <Stack.Screen name="DailySheetForm" component={DailySheetFormScreen} />
          <Stack.Screen name="FortnightDetails" component={FortnightDetailsScreen} />
          <Stack.Screen name="Checkout">
            {props => <CheckoutScreen {...props} profile={profile} />}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {flex: 1},
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.xl, paddingTop: Spacing.xxl,
  },
  drawerLogoBox: {
    width: 40, height: 40, backgroundColor: Colors.zinc900,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  drawerLogoText: {color: Colors.white, fontWeight: '700', fontSize: 18},
  drawerTitle: {fontSize: 16, fontWeight: '700', color: Colors.zinc900},
  drawerSubtitle: {fontSize: 11, color: Colors.zinc500, marginTop: 1},
  divider: {height: 1, backgroundColor: Colors.zinc100, marginBottom: 8},
  drawerFooter: {
    padding: Spacing.xl, marginTop: 'auto',
    borderTopWidth: 1, borderTopColor: Colors.zinc100,
  },
  trialBadge: {
    backgroundColor: Colors.amber50, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: '#fde68a',
  },
  trialBadgeTitle: {
    fontSize: 10, fontWeight: '900', color: Colors.amber700, textTransform: 'uppercase',
  },
  trialBadgeText: {fontSize: 10, fontWeight: '700', color: Colors.amber600, marginTop: 2},
  trialBadgeHint: {fontSize: 9, color: Colors.amber500, marginTop: 2, fontStyle: 'italic'},
  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: Spacing.md, backgroundColor: Colors.zinc50,
    borderRadius: Radius.xl, padding: Spacing.md,
  },
  planText: {fontSize: 12, fontWeight: '700', color: Colors.zinc600},
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: Spacing.md, borderRadius: Radius.xl,
  },
  signOutText: {color: Colors.red600, fontWeight: '700', fontSize: 14},
});
