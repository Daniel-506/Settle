import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { supabase } from "../lib/supabase";
import { EVENT_ICONS, colors, palette, radius } from "../lib/theme";
import {
  ActionSheet,
  Button,
  IconTile,
  PressableScale,
  SectionLabel,
  Sheet,
  TextField,
  confirm,
  toast,
} from "./ui";

export async function setEventStatus(event, status) {
  const { error } = await supabase.from("events").update({ status }).eq("id", event.id);
  if (error) toast(error.message, "error");
  else toast(status === "finished" ? "Moved to past events" : "Event is active again");
  return !error;
}

export async function deleteEvent(event) {
  const ok = await confirm({
    title: `Delete ${event.name}?`,
    message: "All of its expenses and payments are removed for everyone. This can't be undone.",
    confirmText: "Delete",
    destructive: true,
  });
  if (!ok) return false;
  // Clear the event's rows first so the delete can't be blocked by them
  for (const table of ["payments", "expenses", "event_members"]) {
    const { error } = await supabase.from(table).delete().eq("event_id", event.id);
    if (error) {
      toast(error.message, "error");
      return false;
    }
  }
  const { error } = await supabase.from("events").delete().eq("id", event.id);
  if (error) {
    toast(error.message, "error");
    return false;
  }
  toast("Event deleted");
  return true;
}

// Owner menu for an event (used on Home long-press)
export default function EventActions({ event, visible, onClose, onChanged }: any) {
  const [editing, setEditing] = useState(null);
  if (!event && !editing) return null;
  const finished = event?.status === "finished";
  return (
    <>
      <ActionSheet
        visible={visible}
        onClose={onClose}
        title={event?.name}
        actions={[
          { label: "Edit event", icon: "create-outline", onPress: () => setEditing(event) },
          {
            label: finished ? "Mark as active" : "Mark as finished",
            icon: finished ? "refresh-outline" : "flag-outline",
            onPress: async () => {
              if (await setEventStatus(event, finished ? "active" : "finished")) onChanged?.();
            },
          },
          {
            label: "Delete event",
            icon: "trash-outline",
            destructive: true,
            onPress: async () => {
              if (await deleteEvent(event)) onChanged?.();
            },
          },
        ]}
      />
      <EditEventSheet
        event={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}

// Change an event's name, icon and colour
export function EditEventSheet({ event, visible, onClose, onSaved }: any) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("receipt");
  const [color, setColor] = useState("mint");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event) {
      setName(event.name || "");
      setIcon(event.icon || "receipt");
      setColor(event.color || "mint");
    }
  }, [event]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({ name: name.trim(), icon, color })
      .eq("id", event?.id);
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Event updated");
    onClose();
    onSaved?.();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit event" scroll>
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <IconTile icon={icon} colorKey={color} size={64} />
      </View>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Sushi night" />
      <IconAndColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
      <Button title="Save" loading={saving} onPress={save} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

export function IconAndColorPicker({ icon, color, onIcon, onColor }: any) {
  return (
    <>
      <SectionLabel>Icon</SectionLabel>
      <View style={styles.iconGrid}>
        {EVENT_ICONS.map((name) => (
          <PressableScale
            key={name}
            onPress={() => onIcon(name)}
            hapticOnPress="select"
            style={[styles.iconChoice, icon === name && { borderColor: colors.mint }]}
            accessibilityLabel={name}
          >
            <IconTile icon={name} colorKey={icon === name ? color : "blue"} size={40} />
          </PressableScale>
        ))}
      </View>
      <SectionLabel>Colour</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
        {palette.map((p) => (
          <PressableScale
            key={p.key}
            onPress={() => onColor(p.key)}
            hapticOnPress="select"
            accessibilityLabel={p.key}
            style={[
              styles.swatch,
              { backgroundColor: p.fg },
              color === p.key && { borderColor: colors.text, borderWidth: 3 },
            ]}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  iconChoice: {
    padding: 3,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});

