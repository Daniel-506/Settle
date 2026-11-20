import { useLocalSearchParams } from "expo-router";
import ExpenseForm from "../components/ExpenseForm";

export default function AddExpenseScreen() {
  const { event_id } = useLocalSearchParams();
  return <ExpenseForm mode="add" eventId={event_id} />;
}
