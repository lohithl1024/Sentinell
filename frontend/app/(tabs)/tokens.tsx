import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, apiGet, apiPost } from "../../src/auth";
import { colors, riskColor, riskBg } from "../../src/theme";

type UserTokenStats = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  total_tokens: number;
  request_count: number;
  avg_risk: number;
  high_risk_count: number;
  blocked_count: number;
  last_activity: string;
  is_blocked: boolean;
};

export default function TokenMonitorScreen() {
  const { token } = useAuth();
  const [stats, setStats] = useState<UserTokenStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiGet("/api/ai/token-usage", token);
      setStats(data || []);
    } catch (err: any) {
      console.error("Failed to fetch token stats:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const toggleBlock = async (user: UserTokenStats) => {
    const action = user.is_blocked ? "unblock" : "block";
    
    Alert.alert(
      `${action === "block" ? "Block" : "Unblock"} AI Access`,
      `Are you sure you want to ${action} AI access for ${user.name || user.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "block" ? "Block" : "Unblock",
          style: action === "block" ? "destructive" : "default",
          onPress: async () => {
            setActionLoading(user.user_id);
            try {
              await apiPost(`/api/ai/${action}-user/${user.user_id}`, {}, token);
              fetchStats();
            } catch (err: any) {
              Alert.alert("Error", err.message || `Failed to ${action} user`);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getRiskLevel = (avgRisk: number) => {
    if (avgRisk > 80) return "CRITICAL";
    if (avgRisk > 60) return "HIGH";
    if (avgRisk > 40) return "MEDIUM";
    return "LOW";
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const renderUser = ({ item }: { item: UserTokenStats }) => {
    const riskLevel = getRiskLevel(item.avg_risk);
    const isHigh = item.avg_risk > 60 || item.high_risk_count > 5;
    
    return (
      <View style={[styles.card, item.is_blocked && styles.cardBlocked]}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, item.is_blocked && styles.avatarBlocked]}>
              <Ionicons 
                name={item.is_blocked ? "ban" : "person"} 
                size={18} 
                color={item.is_blocked ? colors.critical : colors.textPrimary} 
              />
            </View>
            <View>
              <Text style={styles.userName}>{item.name || "Unknown"}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
            </View>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: colors.card }]}>
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        </View>

        {/* Token Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatTokens(item.total_tokens)}</Text>
            <Text style={styles.statLabel}>Tokens</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{item.request_count}</Text>
            <Text style={styles.statLabel}>Requests</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: riskColor(riskLevel) }]}>
              {item.avg_risk}
            </Text>
            <Text style={styles.statLabel}>Avg Risk</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, item.high_risk_count > 0 && { color: colors.high }]}>
              {item.high_risk_count}
            </Text>
            <Text style={styles.statLabel}>High Risk</Text>
          </View>
        </View>

        {/* Warning if excessive usage */}
        {isHigh && !item.is_blocked && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={14} color={colors.high} />
            <Text style={styles.warningText}>
              Excessive usage or high risk activity detected
            </Text>
          </View>
        )}

        {/* Blocked Banner */}
        {item.is_blocked && (
          <View style={styles.blockedBanner}>
            <Ionicons name="ban" size={14} color={colors.critical} />
            <Text style={styles.blockedText}>AI Access Blocked</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Text style={styles.lastActivity}>
            Last: {item.last_activity ? new Date(item.last_activity).toLocaleDateString() : "Never"}
          </Text>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              item.is_blocked ? styles.unblockBtn : styles.blockBtn,
            ]}
            onPress={() => toggleBlock(item)}
            disabled={actionLoading === item.user_id}
          >
            {actionLoading === item.user_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons 
                  name={item.is_blocked ? "checkmark-circle" : "ban"} 
                  size={14} 
                  color="#fff" 
                />
                <Text style={styles.actionText}>
                  {item.is_blocked ? "Unblock" : "Block AI"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="analytics" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Token Monitor</Text>
            <Text style={styles.headerSub}>AI Usage by User</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.length}</Text>
          <Text style={styles.summaryLabel}>Users</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatTokens(stats.reduce((sum, s) => sum + s.total_tokens, 0))}
          </Text>
          <Text style={styles.summaryLabel}>Total Tokens</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.critical }]}>
            {stats.filter(s => s.is_blocked).length}
          </Text>
          <Text style={styles.summaryLabel}>Blocked</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={stats}
        renderItem={renderUser}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No AI usage data yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  headerSub: { color: colors.textTertiary, fontSize: 11 },
  refreshBtn: { padding: 8 },
  summary: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  summaryItem: { alignItems: "center" },
  summaryValue: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  summaryLabel: { color: colors.textTertiary, fontSize: 10, marginTop: 2 },
  list: { padding: 16, paddingTop: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBlocked: {
    borderColor: colors.criticalBorder,
    backgroundColor: colors.criticalBg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBlocked: { backgroundColor: colors.criticalBg },
  userName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  userEmail: { color: colors.textTertiary, fontSize: 11 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: { color: colors.textSecondary, fontSize: 10, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: { alignItems: "center", flex: 1 },
  statValue: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  statLabel: { color: colors.textTertiary, fontSize: 9, marginTop: 2 },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.highBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  warningText: { color: colors.high, fontSize: 11, flex: 1 },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.criticalBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  blockedText: { color: colors.critical, fontSize: 11, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lastActivity: { color: colors.textTertiary, fontSize: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  blockBtn: { backgroundColor: colors.high },
  unblockBtn: { backgroundColor: colors.low },
  actionText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  empty: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: { color: colors.textTertiary, fontSize: 14, marginTop: 12 },
});
