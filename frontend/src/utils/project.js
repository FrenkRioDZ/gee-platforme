// "SATO 1 · SILO BERRICHE OEB" — same as the backend Project `label` virtual
export const projectLabel = (p) => (p?.code ? `${p.code} · ${p.name}` : p?.name);
