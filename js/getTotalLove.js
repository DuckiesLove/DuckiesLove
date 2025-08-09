export function getTotalLove(data) {
  const categories = Array.isArray(data)
    ? data
    : Array.isArray(data?.categories)
      ? data.categories
      : [];
  let total = 0;
  for (const cat of categories) {
    const items = Array.isArray(cat?.items) ? cat.items : [];
    for (const item of items) {
      const a = item.partnerA ?? item.a;
      const b = item.partnerB ?? item.b;
      if (a === 5 && b === 5) total++;
    }
  }
  return total;
}
