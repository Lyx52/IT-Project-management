export enum PostCategory {
  Electronics = 1,
  JewelryAccessories = 2,
  BagsBackpacks = 3,
  Clothing = 4,
  Documents = 5,
  Keys = 6,
  WalletsMoney = 7,
  SportsHobbies = 8,
  Other = 9,
}

export const POST_CATEGORIES = [
  { id: PostCategory.Electronics, name: 'Electronics' },
  { id: PostCategory.JewelryAccessories, name: 'Jewelry & Accessories' },
  { id: PostCategory.BagsBackpacks, name: 'Bags & Backpacks' },
  { id: PostCategory.Clothing, name: 'Clothing' },
  { id: PostCategory.Documents, name: 'Documents' },
  { id: PostCategory.Keys, name: 'Keys' },
  { id: PostCategory.WalletsMoney, name: 'Wallets & Money' },
  { id: PostCategory.SportsHobbies, name: 'Sports & Hobbies' },
  { id: PostCategory.Other, name: 'Other' },
] as const;
