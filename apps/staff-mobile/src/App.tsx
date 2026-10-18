import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useFonts, CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond";
import { Jost_400Regular, Jost_500Medium } from "@expo-google-fonts/jost";
import { api, ApiError, type Item, type Room, type Task } from "./api";
import { c, font, ROOM_STATUS, TASK_TYPE } from "./theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

type Tab = "tasks" | "rooms" | "stock";

async function registerPush() {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await api.registerDevice(token.data, Platform.OS === "ios" ? "ios" : "android");
}

export default function App() {
  const [fonts] = useFonts({ CormorantGaramond_500Medium, Jost_400Regular, Jost_500Medium });
  const [user, setUser] = useState<{ name: string } | null | undefined>(undefined);

  useEffect(() => {
    api.me().then((u) => setUser({ name: u.name })).catch(() => setUser(null));
  }, []);

  if (!fonts || user === undefined) {
    return (
      <View style={[s.fill, { backgroundColor: c.deep, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={c.gold} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style={user ? "dark" : "light"} />
      {user ? <Main name={user.name} onLogout={() => api.logout().then(() => setUser(null))} /> : <Login onDone={(name) => { setUser({ name }); void registerPush().catch(() => {}); }} />}
    </SafeAreaProvider>
  );
}

function Login({ onDone }: { onDone: (name: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.deep, padding: 28, justifyContent: "center" }]}>
      <Text style={[s.label, { color: c.gold }]}>HOSTEL</Text>
      <Text style={{ fontFamily: font.display, fontSize: 52, color: c.ivory, letterSpacing: 6 }}>ADONIS</Text>
      <Text style={[s.label, { color: "#a9b6bf", marginBottom: 40 }]}>CASĂ · CURĂȚENIE · ÎNTREȚINERE</Text>
      <TextInput style={s.darkInput} placeholder="E-mail" placeholderTextColor="#7b8d99" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.darkInput} placeholder="Parolă" placeholderTextColor="#7b8d99" secureTextEntry value={password} onChangeText={setPassword} />
      {error && <Text style={{ color: "#ef9a90", fontFamily: font.body, marginBottom: 12 }}>{error}</Text>}
      <Pressable
        style={[s.btn, { backgroundColor: c.gold }]}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            const u = await api.login(email.trim(), password);
            onDone(u.name);
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Nu ne putem conecta la server. Verificați Wi-Fi-ul.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text style={[s.btnText, { color: c.navy }]}>{busy ? "Se conectează…" : "Intră"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Main({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("tasks");
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.ivory }]} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.label}>{new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</Text>
          <Text style={s.h1}>Bună, {name}</Text>
        </View>
        <Pressable onPress={onLogout} hitSlop={12}>
          <Feather name="log-out" size={20} color={c.muted} />
        </Pressable>
      </View>
      <View style={s.fill}>{tab === "tasks" ? <Tasks /> : tab === "rooms" ? <Rooms /> : <Stock />}</View>
      <SafeAreaView edges={["bottom"]} style={s.tabbar}>
        {([["tasks", "check-square", "Sarcini"], ["rooms", "grid", "Camere"], ["stock", "package", "Consumabile"]] as const).map(([k, icon, label]) => (
          <Pressable key={k} style={s.tab} onPress={() => setTab(k)}>
            <Feather name={icon} size={20} color={tab === k ? c.gold : "#7b8d99"} />
            <Text style={[s.tabText, tab === k && { color: c.ivory }]}>{label}</Text>
          </Pressable>
        ))}
      </SafeAreaView>
    </SafeAreaView>
  );
}

function useList<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await load());
    } catch (e) {
      Alert.alert("Nu am putut încărca", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, loading, refresh, setItems };
}

const NEXT: Record<Task["status"], [Task["status"], string] | null> = { todo: ["in_progress", "Încep"], in_progress: ["done", "Gata"], done: ["verified", "Verificat"], verified: null };

function Tasks() {
  const { items, loading, refresh } = useList(api.tasks);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000); // cronometrul sarcinilor în lucru
    return () => clearInterval(t);
  }, []);

  const takePhoto = async (task: Task) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Avem nevoie de cameră", "Permiteți accesul la cameră din setările telefonului.");
    const shot = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (shot.canceled || !shot.assets[0].base64) return;
    try {
      await api.photo(task.id, `data:image/jpeg;base64,${shot.assets[0].base64}`);
      Alert.alert("Poza a fost salvată", "Are pe ea camera, data și ora.");
      void refresh();
    } catch (e) {
      Alert.alert("Nu am putut trimite poza", (e as Error).message);
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(t) => t.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.gold} />}
      ListEmptyComponent={!loading ? <Text style={s.empty}>Nicio sarcină deschisă. O zi liniștită!</Text> : null}
      renderItem={({ item: t }) => {
        const next = NEXT[t.status];
        const minutes = t.startedAt ? Math.round((Date.now() - new Date(t.startedAt).getTime()) / 60000) : 0;
        return (
          <View style={s.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <Text style={s.roomNo}>{t.room.number}</Text>
                <Text style={s.body}>{TASK_TYPE[t.type] ?? t.type}</Text>
              </View>
              {t.priority === "high" && <Text style={[s.pill, { color: c.error, backgroundColor: c.errorSoft }]}>urgent</Text>}
            </View>
            {t.notes && <Text style={[s.muted, { fontStyle: "italic" }]}>{t.notes}</Text>}
            {t.status === "in_progress" && <Text style={[s.muted, { color: c.goldText }]}>În lucru de {minutes} min</Text>}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              {next && (
                <Pressable style={[s.btn, { flex: 1, backgroundColor: c.navy }]} onPress={async () => { await api.advance(t.id, next[0]).catch((e) => Alert.alert("Eroare", e.message)); void refresh(); }}>
                  <Text style={[s.btnText, { color: c.ivory }]}>{next[1]}</Text>
                </Pressable>
              )}
              <Pressable style={[s.btn, s.btnGhost]} onPress={() => takePhoto(t)}>
                <Feather name="camera" size={16} color={c.navy} />
                <Text style={[s.btnText, { color: c.navy, marginLeft: 6 }]}>Daună{t.photos.length ? ` (${t.photos.length})` : ""}</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function Rooms() {
  const { items, loading, refresh } = useList(api.rooms);
  return (
    <FlatList
      data={items}
      numColumns={3}
      keyExtractor={(r) => r.id}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.gold} />}
      renderItem={({ item: r }: { item: Room }) => {
        const st = ROOM_STATUS[r.status];
        return (
          <View style={[s.card, { flex: 1, padding: 12, gap: 6 }]}>
            <Text style={s.roomNo}>{r.number}</Text>
            <Text style={[s.pill, { color: st.fg, backgroundColor: st.bg, alignSelf: "flex-start" }]}>{st.label}</Text>
            <Text style={s.muted}>{r.departureToday ? "Pleacă azi" : r.arrivalToday ? "Sosire azi" : r.occupied ? "Ocupată" : "Liberă"}</Text>
          </View>
        );
      }}
    />
  );
}

function Stock() {
  const { items, loading, refresh, setItems } = useList(api.inventory);
  const change = async (it: Item, q: number) => {
    try {
      const updated = await api.adjust(it.id, q, q > 0 ? "restock" : "adjustment");
      setItems((xs) => xs.map((x) => (x.id === it.id ? updated : x)));
    } catch (e) {
      Alert.alert("Eroare", (e as Error).message);
    }
  };
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.gold} />}
      renderItem={({ item: it }) => {
        const low = it.stock <= it.minStock;
        return (
          <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.body}>{it.name}</Text>
              <Text style={[s.muted, low && { color: c.error }]}>{low ? `Stoc mic · minim ${it.minStock}` : `minim ${it.minStock} ${it.unit}`}</Text>
            </View>
            <Pressable style={s.round} onPress={() => change(it, -1)}><Feather name="minus" size={16} color={c.navy} /></Pressable>
            <Text style={[s.roomNo, { minWidth: 48, textAlign: "center", fontSize: 26 }]}>{Math.round(it.stock * 10) / 10}</Text>
            <Pressable style={s.round} onPress={() => change(it, 10)}><Text style={{ fontFamily: font.bodyMedium, color: c.navy }}>+10</Text></Pressable>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderColor: c.line },
  h1: { fontFamily: font.display, fontSize: 34, color: c.navy },
  label: { fontFamily: font.bodyMedium, fontSize: 11, letterSpacing: 2, color: c.muted },
  body: { fontFamily: font.body, fontSize: 15, color: c.text },
  muted: { fontFamily: font.body, fontSize: 13, color: c.muted },
  empty: { fontFamily: font.display, fontSize: 22, color: c.muted, textAlign: "center", marginTop: 60 },
  card: { backgroundColor: c.pearl, borderWidth: 1, borderColor: c.line, borderRadius: 4, padding: 16, gap: 4 },
  roomNo: { fontFamily: font.display, fontSize: 32, color: c.navy, lineHeight: 36 },
  pill: { fontFamily: font.bodyMedium, fontSize: 11, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, overflow: "hidden" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4 },
  btnGhost: { borderWidth: 1, borderColor: c.line, backgroundColor: c.pearl },
  btnText: { fontFamily: font.bodyMedium, fontSize: 15 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" },
  darkInput: { borderWidth: 1, borderColor: "#1d3a4c", borderRadius: 4, paddingHorizontal: 14, paddingVertical: 13, color: c.ivory, fontFamily: font.body, fontSize: 16, marginBottom: 12 },
  tabbar: { flexDirection: "row", backgroundColor: c.deep, paddingTop: 10 },
  tab: { flex: 1, alignItems: "center", gap: 4, paddingBottom: 8 },
  tabText: { fontFamily: font.body, fontSize: 11, color: "#7b8d99" },
});
