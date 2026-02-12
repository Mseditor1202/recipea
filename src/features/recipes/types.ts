import type { Timestamp } from "firebase/firestore";

export type Recipe = {
  id: string;
  userId: string;
  title: string;
  imageUrl?: string;
  tags?: string[];
  memo?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
