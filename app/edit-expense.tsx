import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [allMembers, setAllMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [customSplits, setCustomSplits] = useState({});
  const [showCustom, setShowCustom] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadExpense();
  }, []);

  async function loadExpense() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id);

    const { data: expense } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();
    if (!expense) return;

    setName(expense.name);
    setAmount(expense.amount.toString());

    const { data: memberRows } = await supabase
      .from("event_members")
      .select("user_id")
      .eq("event_id", expense.event_id);

    if (!memberRows || memberRows.length === 0) return;

    const userIds = memberRows.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);

    if (profiles) {
      setAllMembers(profiles);
      const splitIds = expense.split_member_ids || profiles.map((p) => p.id);
      setSelectedIds(splitIds);

      if (expense.custom_splits) {
        const customById = {};
        Object.entries(expense.custom_splits).forEach(([displayName, amt]) => {
          const m = profiles.find((p) => p.display_name === displayName);
          if (m) customById[m.id] = amt.toString();
        });
        setCustomSplits(customById);
        if (Object.keys(customById).length > 0) setShowCustom(true);
      }
    }
  }

  const toggleMember = (memberId) => {
    if (selectedIds.includes(memberId)) {
      setSelectedIds(selectedIds.filter((id) => id !== memberId));
      const newCustom = { ...customSplits };
      delete newCustom[memberId];
      setCustomSplits(newCustom);
    } else {
      setSelectedIds([...selectedIds, memberId]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === allMembers.length) {
      setSelectedIds([]);
      setCustomSplits({});
    } else {
      setSelectedIds(allMembers.map((m) => m.id));
    }
  };

  const setCustomAmount = (memberId, value) => {
    const filtered = value.replace(/[^0-9.]/g, "");
    if (filtered === "") {
      const newCustom = { ...customSplits };
      delete newCustom[memberId];
      setCustomSplits(newCustom);
    } else {
      setCustomSplits({ ...customSplits, [memberId]: filtered });
    }
  };

  const handleSave = async () => {
    if (!name || !amount || selectedIds.length === 0) {
      setError("Please fill in name, amount, and select at least one member.");
      return;
    }
    setLoading(true);
    setError("");

    const customSplitsByName = {};
    Object.entries(customSplits).forEach(([id, amt]) => {
      const member = allMembers.find((m) => m.id === id);
      if (member && amt)
        customSplitsByName[member.display_name] = parseFloat(amt);
    });

    const { error } = await supabase
      .from("expenses")
      .update({
        name,
        amount: parseFloat(amount),
        split_between: selectedIds.length,
        split_member_ids: selectedIds,
        custom_splits: customSplitsByName,
      })
      .eq("id", id);

    if (error) setError(error.message);
    else router.back();
    setLoading(false);
  };

  const handleDelete = () => {
    Alert.alert("Delete Expense", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("expenses").delete().eq("id", id);
          router.back();
        },
      },
    ]);
  };

  const getInitials = (name) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const totalCustom = Object.values(customSplits).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  );
  const remainingMembers = selectedIds.filter((id) => !customSplits[id]);
  const totalAmount = parseFloat(amount) || 0;
  const evenShare =
    remainingMembers.length > 0
      ? (totalAmount - totalCustom) / remainingMembers.length
      : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Edit Expense</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>What did you buy?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Drinks, Salmon, Pizza"
          placeholderTextColor="#8B8B8B"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>How much did it cost?</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#8B8B8B"
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.splitHeader}>
          <Text style={styles.label}>Who's splitting?</Text>
          <TouchableOpacity onPress={toggleAll}>
            <Text style={styles.selectAllText}>
              {selectedIds.length === allMembers.length
                ? "Deselect all"
                : "Select all"}
            </Text>
          </TouchableOpacity>
        </View>

        {allMembers.map((member) => {
          const isSelected = selectedIds.includes(member.id);
          const isCustom = !!customSplits[member.id];
          return (
            <View key={member.id} style={styles.memberRow}>
              <TouchableOpacity
                style={styles.memberMain}
                onPress={() => toggleMember(member.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}
                >
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {getInitials(member.display_name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {member.display_name}
                    {member.id === currentUserId && (
                      <Text style={styles.youLabel}> (You)</Text>
                    )}
                  </Text>
                  {isSelected && !isCustom && totalAmount > 0 && (
                    <Text style={styles.memberShare}>
                      ${evenShare.toFixed(2)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              {isSelected && showCustom && (
                <View style={styles.customInputRow}>
                  <Text style={styles.dollarSignSmall}>$</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="auto"
                    placeholderTextColor="#8B8B8B"
                    value={customSplits[member.id] || ""}
                    onChangeText={(text) => setCustomAmount(member.id, text)}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.customToggle}
          onPress={() => setShowCustom(!showCustom)}
        >
          <Text style={styles.customToggleText}>
            {showCustom ? "Hide custom amounts" : "+ Set custom amounts"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.saveButton,
          (!name || !amount) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={loading || !name || !amount}
      >
        <Text style={styles.saveButtonText}>
          {loading ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Expense</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  backButton: { marginBottom: 20 },
  backText: { color: "#00F5D4", fontSize: 15, fontWeight: "500" },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  label: {
    color: "#8B8B8B",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#161616",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#262626",
    marginBottom: 20,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#262626",
    marginBottom: 20,
    paddingLeft: 16,
  },
  dollarSign: { color: "#00F5D4", fontSize: 20, fontWeight: "600" },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  splitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  selectAllText: { color: "#9B5DE5", fontSize: 13, fontWeight: "600" },
  memberRow: {
    backgroundColor: "#161616",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#262626",
  },
  memberMain: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#8B8B8B",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: "#00F5D4", borderColor: "#00F5D4" },
  checkmark: { color: "#0A0A0A", fontSize: 13, fontWeight: "900" },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#9B5DE5",
  },
  memberAvatarText: { color: "#9B5DE5", fontSize: 12, fontWeight: "600" },
  memberName: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  youLabel: { color: "#00F5D4", fontSize: 12, fontWeight: "500" },
  memberShare: { color: "#8B8B8B", fontSize: 12, marginTop: 2 },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingLeft: 80,
    gap: 4,
  },
  dollarSignSmall: { color: "#00F5D4", fontSize: 14, fontWeight: "600" },
  customInput: {
    flex: 1,
    backgroundColor: "#262626",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#363636",
  },
  customToggle: { padding: 12, alignItems: "center", marginTop: 4 },
  customToggleText: { color: "#9B5DE5", fontSize: 13, fontWeight: "600" },
  saveButton: {
    backgroundColor: "#00F5D4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
  deleteButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
  deleteButtonText: { color: "#F15BB5", fontSize: 14, fontWeight: "600" },
  error: {
    color: "#F15BB5",
    fontSize: 13,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#1A0A14",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F15BB5",
  },
});
