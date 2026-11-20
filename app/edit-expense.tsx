import { useLocalSearchParams } from "expo-router";
import ExpenseForm from "../components/ExpenseForm";

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams();
  return <ExpenseForm mode="edit" expenseId={id} />;
}
