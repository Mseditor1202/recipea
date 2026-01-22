import * as repo from "../repositories/shoppingRepo";

// ユースケース（長い・副作用あり）を service に集めていく
export const generateShoppingDraftFromPlans =
  repo.generateShoppingDraftFromPlans;
export const applyDraftToShoppingItems = repo.applyDraftToShoppingItems;
export const getDraftSession = repo.getDraftSession;
export const getDraftItems = repo.getDraftItems;
export const setDraftItemSkip = repo.setDraftItemSkip;
export const setDraftItemMemo = repo.setDraftItemMemo;

// shoppingItems 側（必要なら）
export const getShoppingItemsByUser = repo.getShoppingItemsByUser;
export const addShoppingItem = repo.addShoppingItem;
export const setShoppingItemPurchased = repo.setShoppingItemPurchased;
export const setShoppingItemSkip = repo.setShoppingItemSkip;
export const setShoppingItemMemo = repo.setShoppingItemMemo;
export const deleteShoppingItem = repo.deleteShoppingItem;
export const markAllPurchased = repo.markAllPurchased;
export const deleteAllShoppingItems = repo.deleteAllShoppingItems;
export const syncActiveItemsToFridge = repo.syncActiveItemsToFridge;

// note
export const getShoppingNotesByUser = repo.getShoppingNotesByUser;
export const setShoppingNotesByUser = repo.setShoppingNotesByUser;
export const getUserPlan = repo.getUserPlan;
