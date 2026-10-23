export type DsaTopic = {
  id: string;
  name: string;
  countLabel: string;
  description: string;
};

export const dsaTopics: DsaTopic[] = [
  {
    id: "arrays-hashing",
    name: "Arrays & Hashing",
    countLabel: "12 patterns",
    description: "Organize data and solve lookup problems efficiently.",
  },
  {
    id: "two-pointers",
    name: "Two Pointers",
    countLabel: "8 patterns",
    description: "Coordinate multiple positions in a sequence.",
  },
  {
    id: "sliding-window",
    name: "Sliding Window",
    countLabel: "6 patterns",
    description: "Process contiguous ranges without repeated work.",
  },
  {
    id: "trees-graphs",
    name: "Trees & Graphs",
    countLabel: "14 patterns",
    description: "Model relationships, traversal, and connectivity.",
  },
  {
    id: "dynamic-programming",
    name: "Dynamic Programming",
    countLabel: "11 patterns",
    description: "Reuse overlapping subproblem results.",
  },
  {
    id: "binary-search",
    name: "Binary Search",
    countLabel: "7 patterns",
    description: "Reduce search space using ordered structure.",
  },
];
