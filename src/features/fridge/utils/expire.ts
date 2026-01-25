export const calcRemainDays = (expireAt: Date | string | number): number => {
  const end = expireAt instanceof Date ? expireAt : new Date(expireAt);
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = b.getTime() - a.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const getExpireLevel = (
  remainDays: number,
): "DANGER" | "WARN" | "CAUTION" | "SAFE" => {
  if (remainDays <= 0) return "DANGER";
  if (remainDays <= 2) return "WARN";
  if (remainDays <= 5) return "CAUTION";
  return "SAFE";
};
