import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconAndColorPicker } from "../components/EventActions";
import PeoplePicker from "../components/PeoplePicker";
import { Avatar, Button, Header, IconTile, PressableScale, SectionLabel, toast } from "../components/ui";
import { supabase } from "../lib/supabase";
import { EVENT_ICONS, colors, font, noOutline, palette, radius } from "../lib/theme";
import useStore from "../store/useStore";
import { enter, exit, layoutShift } from "../lib/motion";

export default function NewEventScreen() {
  const insets = useSafeAreaInsets();
  const { with: withId } = useLocalSearchParams();
  const userId = useStore((s) => s.userId);
  const profile = useStore((s) => s.profile);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(EVENT_ICONS[0]);
  const [color, setColor] = useState(palette[Math.floor(Math.random() * palette.length)].key);
  const [people, setPeople] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // "Start an event with this friend" from the Friends tab
  useEffect(() => {
    if (!withId) return;
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", withId)
      .maybeSingle()
      .then(({ data }) => data && setPeople([data]));
  }, [withId]);

  const togglePerson = (p) => {
    setPeople((list) =>
      list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p],
    );
  };

  const create = async () => {
    if (!name.trim()) {
      setError("Give your event a name.");
      return;
    }
    setSaving(true);
    setError("");
    const base = {
      name: name.trim(),
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      created_by: userId,
    };
    let { data: event, error: eventError } = await supabase
      .from("events")
      .insert({ ...base, icon, color })
      .select()
      .single();
    // Before the latest database update, events have no icon/colour columns
    if (eventError && /icon|color|schema cache/i.test(eventError.message)) {
      ({ data: event, error: eventError } = await supabase.from("events").insert(base).select().single());
    }
    if (eventError) {
      setSaving(false);
      setError(eventError.message);
      return;
    }
    const rows = [userId, ...people.map((p) => p.id)]
      .filter((id, i, all) => all.indexOf(id) === i)
      .map((id) => ({ event_id: event.id, user_id: id, status: "active" }));
    const { error: membersError } = await supabase.from("event_members").insert(rows);
    setSaving(false);
    if (membersError) {
      setError(membersError.message);
      return;
    }
    toast(`${event.name} created`);
    router.replace(`/event/${event.id}`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: Platform.OS === "ios" ? 14 : insets.top + 8 }}>
        <Header title="New event" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter} style={styles.preview}>
          <IconTile icon={icon} colorKey={color} size={72} />
        </Animated.View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name your event"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.mint}
          autoFocus
          style={[styles.nameInput, noOutline]}
          accessibilityLabel="Event name"
        />
        <Text style={[font.small, { color: colors.textMuted, textAlign: "center", marginBottom: 22 }]}>
          Sushi night, Montreal trip, apartment bills…
        </Text>

        <IconAndColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />

        <SectionLabel>Who&apos;s in?</SectionLabel>
        <Animated.View layout={layoutShift} style={styles.selected}>
          <View style={styles.personChip}>
            <Avatar id={userId} name={profile?.display_name} uri={profile?.avatar_url} size={26} />
            <Text style={[font.small, { color: colors.text, fontWeight: "700" }]}>You</Text>
          </View>
          {people.map((p) => (
            <Animated.View key={p.id} entering={enter} exiting={exit} layout={layoutShift}>
              <PressableScale onPress={() => togglePerson(p)} style={[styles.personChip, styles.personChipOn]} accessibilityLabel={`Remove ${p.display_name}`}>
                <Avatar id={p.id} name={p.display_name} uri={p.avatar_url} size={26} />
                <Text style={[font.small, { color: colors.text, fontWeight: "700" }]}>{p.display_name}</Text>
                <Ionicons name="close" size={14} color={colors.textSecondary} />
              </PressableScale>
            </Animated.View>
          ))}
        </Animated.View>

        <PeoplePicker userId={userId} selectedIds={people.map((p) => p.id)} onPick={togglePerson} />
        <Text style={[font.small, { color: colors.textMuted, marginTop: 4 }]}>
          You can also invite people later with a link or QR code.
        </Text>

        {error ? (
          <Animated.Text entering={enter} style={[font.small, { color: colors.pink, marginTop: 16 }]}>
            {error}
          </Animated.Text>
        ) : null}
      </ScrollView>

      <Animated.View entering={enter} style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title={people.length ? `Create with ${people.length + 1} people` : "Create event"}
          haptic="medium"
          loading={saving}
          onPress={create}
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14,
  },
  nameInput: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 6,
    letterSpacing: -0.5,
  },
  selected: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  personChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personChipOn: {
    backgroundColor: colors.mintSoft,
    borderColor: colors.mintBorder,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
