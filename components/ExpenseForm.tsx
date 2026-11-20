import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  customSplitFields,
  loadMembers,
  nameLookup,
  normalizeExpense,
  validateExpense,
} from "../lib/eventData";
import { dayLabel, formatMoney, todayKey } from "../lib/format";
import { deleteReceipt, pickReceipt, receiptUrl, uploadReceipt } from "../lib/receipts";
import { splitExpense } from "../lib/splitCalculator";
import { supabase } from "../lib/supabase";
import { CATEGORIES, categoryFor, colors, font, guessCategory, money, noOutline, radius } from "../lib/theme";
import useStore from "../store/useStore";
import {
  Avatar,
  Button,
  CalendarSheet,
  Card,
  Chip,
  Header,
  IconButton,
  IconTile,
  PressableScale,
  SectionLabel,
  Sheet,
  TextField,
  confirm,
  toast,
} from "./ui";

// Digits and one decimal point, max 2 decimals (blocks things like "1.2.3")
const cleanAmount = (text) => {
  const [whole, ...rest] = text.replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
};

// mode "add" needs eventId; mode "edit" needs expenseId
export default function ExpenseForm({ mode, eventId: eventIdProp, expenseId }: any) {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.userId);
  const [eventId, setEventId] = useState(eventIdProp || null);
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(null);
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [paidById, setPaidById] = useState(null);
  const [dateKey, setDateKey] = useState(todayKey());
  const [selectedIds, setSelectedIds] = useState([]);
  const [customSplits, setCustomSplits] = useState({});
  const [showCustom, setShowCustom] = useState(false);
  const [note, setNote] = useState("");
  const [receiptPath, setReceiptPath] = useState(null); // saved file
  const [receiptPreview, setReceiptPreview] = useState(null); // url to show
  const [newReceipt, setNewReceipt] = useState(null); // local file to upload
  const [removeReceipt, setRemoveReceipt] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (mode === "edit") {
      const { data: row } = await supabase.from("expenses").select("*").eq("id", expenseId).single();
      if (!row) return;
      const profiles = await loadMembers(row.event_id);
      const e = normalizeExpense(row, nameLookup(profiles));
      const ids = profiles.map((p) => p.id);
      setEventId(row.event_id);
      setMembers(profiles);
      setAmount(String(e.amount));
      setName(e.name || "");
      setCategory(e.category || guessCategory(e.name) || "other");
      setCategoryPicked(!!e.category);
      setPaidById(e.paidById);
      setDateKey(e.dateKey || todayKey());
      const split = e.splitIds.filter((x) => ids.includes(x));
      setSelectedIds(split.length ? split : ids);
      const custom = {};
      Object.entries(e.customById).forEach(([uid, amt]) => {
        if (ids.includes(uid) && Number(amt) > 0) custom[uid] = String(amt);
      });
      setCustomSplits(custom);
      setShowCustom(Object.keys(custom).length > 0);
      setNote(e.note || "");
      setReceiptPath(e.receipt_path || null);
      if (e.receipt_path) setReceiptPreview(await receiptUrl(e.receipt_path));
    } else {
      const profiles = await loadMembers(eventIdProp);
      setMembers(profiles);
      setSelectedIds(profiles.map((p) => p.id));
    }
    setLoaded(true);
  }, [mode, expenseId, eventIdProp]);

  useEffect(() => {
    load();
  }, [load]);

  // Default payer is you
  useEffect(() => {
    if (mode === "add" && !paidById && userId) setPaidById(userId);
  }, [mode, paidById, userId]);

  // Guess the category from the name until you pick one yourself
  useEffect(() => {
    if (!categoryPicked) setCategory(guessCategory(name));
  }, [name, categoryPicked]);

  const memberIds = members.map((m) => m.id);
  const total = parseFloat(amount) || 0;
  const preview = splitExpense({ amount: total, splitIds: selectedIds, customById: customSplits }, memberIds);
  const customTotal = selectedIds.reduce((s, uid) => s + (Number(customSplits[uid]) || 0), 0);

  const toggle = (uid) => {
    if (selectedIds.includes(uid)) {
      setSelectedIds(selectedIds.filter((x) => x !== uid));
      const next = { ...customSplits };
      delete next[uid];
      setCustomSplits(next);
    } else {
      setSelectedIds([...selectedIds, uid]);
    }
  };

  const setCustom = (uid, value) => {
    const v = cleanAmount(value);
    const next = { ...customSplits };
    if (v === "") delete next[uid];
    else next[uid] = v;
    setCustomSplits(next);
  };

  const attach = async (source) => {
    const uri = await pickReceipt(source);
    if (!uri) return;
    setNewReceipt(uri);
    setReceiptPreview(uri);
    setRemoveReceipt(false);
  };

  const save = async () => {
    const problem = validateExpense({ name, amount, selectedIds, customById: customSplits });
    if (problem) {
      setError(problem);
      return;
    }
    if (!paidById) {
      setError("Pick who paid.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let path = removeReceipt ? null : receiptPath;
      if (newReceipt) path = await uploadReceipt(eventId, newReceipt);

      const payer = members.find((m) => m.id === paidById);
      const fields = {
        name: name.trim(),
        amount: Math.round(parseFloat(amount) * 100) / 100,
        paid_by_id: paidById,
        // name copies are still read by older app builds
        paid_by: payer?.display_name || "",
        split_between: selectedIds.length,
        split_member_ids: selectedIds,
        ...customSplitFields(customSplits, members),
        category: category || "other",
        expense_date: dateKey,
        note: note.trim() || null,
        receipt_path: path,
      };

      const { error: saveError } =
        mode === "edit"
          ? await supabase.from("expenses").update(fields).eq("id", expenseId)
          : await supabase.from("expenses").insert({ ...fields, event_id: eventId, created_by: userId });
      if (saveError) throw saveError;

      // Old receipt no longer used
      if (receiptPath && receiptPath !== path) deleteReceipt(receiptPath);
      toast(mode === "edit" ? "Expense saved" : "Expense added");
      router.back();
    } catch (e) {
      setError(
        /column .* does not exist|schema cache/i.test(e.message || "")
          ? "The latest database update hasn't been run in Supabase yet."
          : e.message || "Couldn't save. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Delete expense?",
      message: `${name || "This expense"} will be removed for everyone.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (deleteError) {
      toast(deleteError.message, "error");
      return;
    }
    if (receiptPath) deleteReceipt(receiptPath);
    toast("Expense deleted");
    router.back();
  };

  const cat = categoryFor(category);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: Platform.OS === "ios" ? 14 : insets.top + 8 }}>
        <Header
          title={mode === "edit" ? "Edit expense" : "Add expense"}
          onBack={() => router.back()}
          right={
            mode === "edit" ? (
              <IconButton icon="trash-outline" label="Delete expense" tint={colors.pink} onPress={remove} />
            ) : null
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Amount */}
        <Animated.View entering={FadeIn.duration(250)} style={styles.amountWrap}>
          <IconTile icon={cat.icon} colorKey={cat.color} size={48} />
          <View style={styles.amountRow}>
            <Text style={[styles.amountText, { color: total ? colors.text : colors.textMuted }]}>$</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(cleanAmount(t))}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus={mode === "add"}
              selectionColor={colors.mint}
              style={[
                styles.amountText,
                styles.amountInput,
                noOutline,
                // grow with the number (a text box has no natural width)
                { width: Math.max(4, (amount || "0.00").length) * 30 + 6 },
              ]}
              accessibilityLabel="Amount"
            />
          </View>
        </Animated.View>

        <TextField
          label="What was it for?"
          value={name}
          onChangeText={setName}
          placeholder="Dinner, Uber, groceries"
        />

        {/* Category */}
        <SectionLabel>Category</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              icon={c.icon}
              colorKey={c.color}
              selected={category === c.key}
              onPress={() => {
                setCategory(c.key);
                setCategoryPicked(true);
              }}
            />
          ))}
        </ScrollView>

        {/* Paid by */}
        <SectionLabel>Paid by</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {[...members]
            .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0))
            .map((m) => (
              <Chip
                key={m.id}
                label={m.id === userId ? "You" : m.display_name}
                selected={paidById === m.id}
                onPress={() => setPaidById(m.id)}
                left={<Avatar id={m.id} name={m.display_name} uri={m.avatar_url} size={22} />}
              />
            ))}
        </ScrollView>

        {/* Date */}
        <SectionLabel>Date</SectionLabel>
        <Card onPress={() => setCalendarOpen(true)} style={styles.dateCard}>
          <Ionicons name="calendar-outline" size={20} color={colors.mint} />
          <Text style={[font.body, { color: colors.text, flex: 1, fontWeight: "600" }]}>
            {dayLabel(dateKey)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>

        {/* Split */}
        <SectionLabel
          style={{ marginTop: 18 }}
          right={
            <PressableScale
              onPress={() =>
                selectedIds.length === members.length
                  ? (setSelectedIds([]), setCustomSplits({}))
                  : setSelectedIds(memberIds)
              }
            >
              <Text style={[font.small, { color: colors.mint, fontWeight: "700" }]}>
                {selectedIds.length === members.length ? "Clear" : "Everyone"}
              </Text>
            </PressableScale>
          }
        >
          Split between
        </SectionLabel>
        <Card style={{ paddingVertical: 4 }}>
          {loaded && members.length === 0 && (
            <Text style={[font.small, { color: colors.textSecondary, padding: 10 }]}>
              No members in this event yet.
            </Text>
          )}
          {members.map((m, i) => {
            const on = selectedIds.includes(m.id);
            const isCustom = Number(customSplits[m.id]) > 0;
            return (
              <Animated.View key={m.id} layout={LinearTransition.springify()} style={[i < members.length - 1 && styles.rowBorder]}>
                <PressableScale onPress={() => toggle(m.id)} hapticOnPress="select" scaleTo={0.98} style={styles.splitRow}>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on && <Ionicons name="checkmark" size={15} color={colors.onMint} />}
                  </View>
                  <Avatar id={m.id} name={m.display_name} uri={m.avatar_url} size={34} />
                  <Text style={[font.body, { color: colors.text, flex: 1, fontWeight: "600" }]}>
                    {m.id === userId ? "You" : m.display_name}
                  </Text>
                  {on && total > 0 && !isCustom && (
                    <Text style={[font.body, money, { color: colors.textSecondary }]}>
                      {formatMoney((preview[m.id] || 0) / 100)}
                    </Text>
                  )}
                </PressableScale>
                {on && showCustom && (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.customRow}>
                    <Text style={[font.small, { color: colors.textSecondary, flex: 1 }]}>Custom amount</Text>
                    <View style={styles.customInputWrap}>
                      <Text style={{ color: colors.textMuted, fontWeight: "700" }}>$</Text>
                      <TextInput
                        value={customSplits[m.id] || ""}
                        onChangeText={(t) => setCustom(m.id, t)}
                        placeholder="auto"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        selectionColor={colors.mint}
                        style={[styles.customInput, noOutline]}
                      />
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            );
          })}
        </Card>
        <PressableScale onPress={() => setShowCustom(!showCustom)} style={styles.customToggle}>
          <Ionicons name={showCustom ? "remove-circle-outline" : "options-outline"} size={17} color={colors.mint} />
          <Text style={[font.small, { color: colors.mint, fontWeight: "700" }]}>
            {showCustom ? "Hide custom amounts" : "Set custom amounts"}
          </Text>
        </PressableScale>
        {showCustom && total > 0 && (
          <Text style={[font.small, { color: customTotal > total ? colors.pink : colors.textSecondary, marginBottom: 8 }]}>
            {formatMoney(customTotal)} of {formatMoney(total)} assigned. The rest is split evenly.
          </Text>
        )}

        {/* Note */}
        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          multiline
          inputStyle={{ minHeight: 44, textAlignVertical: "top" }}
          style={{ marginTop: 10 }}
        />

        {/* Receipt */}
        <SectionLabel>Receipt</SectionLabel>
        {receiptPreview && !removeReceipt ? (
          <Animated.View entering={FadeIn} style={styles.receiptRow}>
            <PressableScale onPress={() => setReceiptOpen(true)} accessibilityLabel="View receipt">
              <Image source={{ uri: receiptPreview }} style={styles.receiptThumb} contentFit="cover" transition={200} />
            </PressableScale>
            <View style={{ flex: 1, gap: 8 }}>
              <Button title="Replace" size="sm" variant="secondary" icon="camera-outline" onPress={() => attach("library")} />
              <Button
                title="Remove"
                size="sm"
                variant="danger"
                icon="trash-outline"
                onPress={() => {
                  setRemoveReceipt(true);
                  setNewReceipt(null);
                  setReceiptPreview(null);
                }}
              />
            </View>
          </Animated.View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Platform.OS !== "web" && (
              <Button title="Take photo" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => attach("camera")} />
            )}
            <Button title="Choose photo" icon="image-outline" variant="secondary" style={{ flex: 1 }} onPress={() => attach("library")} />
          </View>
        )}

        {error ? (
          <Animated.View entering={FadeInDown} style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={colors.pink} />
            <Text style={[font.small, { color: colors.pink, flex: 1 }]}>{error}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title={mode === "edit" ? "Save changes" : total ? `Add ${formatMoney(total)}` : "Add expense"}
          haptic="medium"
          loading={saving}
          onPress={save}
        />
      </View>

      <CalendarSheet
        key={calendarOpen ? "open" : "closed"}
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={dateKey}
        onChange={setDateKey}
      />
      <Sheet visible={receiptOpen} onClose={() => setReceiptOpen(false)} title="Receipt">
        {receiptPreview ? (
          <Image source={{ uri: receiptPreview }} style={styles.receiptFull} contentFit="contain" />
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  amountWrap: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 10,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  amountText: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  amountInput: {
    padding: 0,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 18,
    paddingRight: 8,
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 36,
    paddingBottom: 10,
    gap: 10,
  },
  customInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    width: 110,
  },
  customInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 8,
  },
  customToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  receiptRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  receiptThumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  receiptFull: {
    width: "100%",
    height: 460,
    borderRadius: radius.md,
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.pinkSoft,
    borderWidth: 1,
    borderColor: colors.pinkBorder,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
