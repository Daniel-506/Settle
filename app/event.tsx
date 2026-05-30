import { router } from "expo-router";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import useStore from "../store/useStore";

export default function EventScreen() {
  const { expenses } = useStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sushi Night 🍣</Text>
      <Text style={styles.subtitle}>May 18, 2026 · 4 people</Text>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.expenseName}>{item.name}</Text>
              <Text style={styles.expenseDetail}>
                paid by {item.paidBy} · split {item.splitBetween} ways
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
              <Text style={styles.perPerson}>
                ${(item.amount / item.splitBetween).toFixed(2)} each
              </Text>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/add-expense")}
        >
          <Text style={styles.addButtonText}>+ Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settleButton}
          onPress={() => router.push("/settle")}
        >
          <Text style={styles.settleButtonText}>Settle Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  expenseName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  expenseDetail: {
    fontSize: 12,
    color: "#888",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#534AB7",
  },
  perPerson: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 20,
  },
  addButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  settleButton: {
    flex: 1,
    backgroundColor: "#534AB7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  settleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
