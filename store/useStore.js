import { create } from "zustand";

const useStore = create((set) => ({
  // The list of expenses for the current event
  expenses: [
    {
      id: "1",
      name: "Salmon fillet",
      amount: 80.0,
      paidBy: "Jake",
      splitBetween: 4,
    },
    { id: "2", name: "Drinks", amount: 33.24, paidBy: "You", splitBetween: 4 },
    {
      id: "3",
      name: "Sauce & ginger",
      amount: 5.76,
      paidBy: "You",
      splitBetween: 4,
    },
  ],

  // Function to add a new expense
  addExpense: (expense) =>
    set((state) => ({
      expenses: [...state.expenses, expense],
    })),

  // Function to clear all expenses
  clearExpenses: () => set({ expenses: [] }),
}));

module.exports = useStore;
