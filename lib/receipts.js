import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

// Returns a local image uri, or null if cancelled / no permission
export async function pickReceipt(source = "library") {
  const options = { mediaTypes: ["images"], quality: 0.6, allowsEditing: false };
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return null;
    const result = await ImagePicker.launchCameraAsync(options);
    return result.canceled ? null : result.assets[0].uri;
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;
  const result = await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0].uri;
}

// Stored as receipts/<event id>/<random>.jpg so only event members can read it
export async function uploadReceipt(eventId, uri) {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, buffer, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

// Temporary link to view a receipt (valid for an hour)
export async function receiptUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function deleteReceipt(path) {
  if (!path) return;
  await supabase.storage.from("receipts").remove([path]);
}
