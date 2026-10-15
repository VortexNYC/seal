export function rememberCreatedOrganization<T extends { slug: string }>(
  current: readonly T[] | undefined,
  created: T
): T[] {
  const list = current ? [...current] : [];
  if (list.some((item) => item.slug === created.slug)) return list;
  return [...list, created];
}
