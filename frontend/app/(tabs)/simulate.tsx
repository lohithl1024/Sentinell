import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, apiGet, apiPost } from "../../src/auth";
import { colors, mono, riskColor, riskBg, riskBorder } from "../../src/theme";

const SCENARIOS = [
  { key: "normal",        label: "Normal Login",    icon: "checkmark-circle-outline", color: colors.low,    desc: "Baseline behavior, expected LOW risk" },
  { key: "night_login",   label: "Night Login",     icon: "moon-outline",             color: colors.medium, desc: "Login at unusual hour (03:00)" },
  { key: "new_location",  label: "New Location",    icon: "globe-outline",            color: colors.high,   desc: "Login from foreign geo (Moscow, RU)" },
  { key: "new_device",    label: "New Device",      icon: "phone-portrait-outline",   color: colors.medium, desc: "Unknown device used" },
  { key: "brute_force",   label: "Brute Force",     icon: "lock-closed-outline",      color: colors.high,   desc: "5+ failed login attempts" },
  { key: "high_traffic",  label: "Traffic Spike",   icon: "pulse-outline",            color: colors.high,   desc: "Abnormal data usage / request volume" },
  { key: "role_mismatch", label: "Role Mismatch",   icon: "people-outline",           color: colors.high,   desc: "Login outside role-based hours" },
];

export default function Simulate() {
  const { token } = useAuth();
  const [demoUsers, setDemoUsers] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string>("alice@ueba.io");
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet("/api/demo-users", token).then((r) => {
      setDemoUsers(r);
      if (r[0]) setSelectedEmail(r[0].email);
    }).catch(() => {});
  }, [token]);

  const run = async (scenario: string) => {
    setErr(null); setRunning(scenario); setResult(null);
    try {
      const r = await apiPost("/api/simulate", { email: selectedEmail, scenario }, token);
      setResult(r);
    } catch (e: any) { setErr(e.message); }
    finally { setRunning(null); }
  };

  return (
    <SafeAreaView style={styles.c} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.title}>ATTACK SIMULATOR</Text>
        <Text style={styles.sub}>Trigger anomalous login patterns to validate the detection engine.</Text>

        <Text style={styles.sectionLabel}>TARGET USER</Text>
        <View style={styles.userRow}>
          {demoUsers.map((u) => (
            <TouchableOpacity
              key={u.email}
              testID={`target-${u.email.split("@")[0]}`}
              style={[styles.userChip, selectedEmail === u.email && styles.userChipActive]}
              onPress={() => setSelectedEmail(u.email)}
            >
              <Text style={[styles.userChipText, selectedEmail === u.email && { color: colors.primary }]}>
                {u.email}
              </Text>
              {u.role && <Text style={styles.userChipMeta}>{u.role.replace("_", " ")} · {u.shift}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>SCENARIO</Text>
        <View style={styles.grid}>
          {SCENARIOS.map((s) => (
            <TouchableOpacity
              key={s.key}
              testID={`sim-${s.key}`}
              style={[styles.scenario, { borderColor: s.color + "55" }]}
              onPress={() => run(s.key)}
              disabled={running !== null}
            >
              <Ionicons name={s.icon as any} size={22} color={s.color} />
              <Text style={styles.scenarioLabel}>{s.label}</Text>
              <Text style={styles.scenarioDesc}>{s.desc}</Text>
              {running === s.key && <ActivityIndicator color={s.color} style={{ marginTop: 8 }} />}
            </TouchableOpacity>
          ))}
        </View>

        {err && <Text style={styles.err}>{err}</Text>}

        {result && (
          <View testID="sim-result" style={[styles.result, { borderColor: riskBorder(result.risk_level), backgroundColor: riskBg(result.risk_level) }]}>
            <View style={styles.resultHead}>
              <Text style={styles.resultTitle}>DETECTION OUTCOME</Text>
              <Text testID="sim-result-score" style={[styles.resultScore, { color: riskColor(result.risk_level) }]}>{result.risk_score}</Text>
            </View>
            <View style={styles.resultRow}>
              <View style={styles.resultCell}>
                <Text style={styles.cellLabel}>LEVEL</Text>
                <Text style={[styles.cellVal, { color: riskColor(result.risk_level) }]}>{result.risk_level}</Text>
              </View>
              <View style={styles.resultCell}>
                <Text style={styles.cellLabel}>ACTION</Text>
                <Text style={[styles.cellVal, { color: riskColor(result.risk_level), fontSize: 13 }]}>{result.action}</Text>
              </View>
              <View style={styles.resultCell}>
                <Text style={styles.cellLabel}>ANOMALY</Text>
                <Text style={styles.cellVal}>{result.anomaly_score.toFixed(2)}</Text>
              </View>
            </View>
            <Text style={styles.explainHead}>EXPLANATION</Text>
            {result.explanation.map((r: string, i: number) => (
              <View key={i} style={styles.reasonRow}>
                <Ionicons name="alert-circle" size={14} color={riskColor(result.risk_level)} />
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "700", letterSpacing: 1 },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 20 },
  sectionLabel: { color: colors.textTertiary, fontSize: 10, letterSpacing: 2, fontWeight: "700", marginTop: 14, marginBottom: 10 },
  userRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  userChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  userChipActive: { borderColor: colors.primary, backgroundColor: "rgba(59,130,246,0.1)" },
  userChipText: { color: colors.textSecondary, fontSize: 12, fontFamily: mono },
  userChipMeta: { color: colors.textTertiary, fontSize: 9, marginTop: 2, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scenario: { width: "48%", backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1 },
  scenarioLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 10 },
  scenarioDesc: { color: colors.textSecondary, fontSize: 11, marginTop: 4, lineHeight: 15 },
  err: { color: colors.high, fontSize: 12, marginTop: 12, fontFamily: mono },
  result: { marginTop: 20, borderRadius: 14, padding: 18, borderWidth: 1 },
  resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { color: colors.textTertiary, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  resultScore: { fontSize: 42, fontFamily: mono, fontWeight: "700" },
  resultRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  resultCell: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  cellLabel: { color: colors.textTertiary, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  cellVal: { color: colors.textPrimary, fontSize: 16, fontFamily: mono, marginTop: 4, fontWeight: "700" },
  explainHead: { color: colors.textTertiary, fontSize: 10, letterSpacing: 2, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  reasonText: { color: colors.textPrimary, fontSize: 12 },
});
