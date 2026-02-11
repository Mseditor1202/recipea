export type Recipe = {
  id: string;
  recipeName?: string;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
  [key: string]: any;
};
