// Helpers shared by the Question Bank Excel pages (Upload Excel, Fix Questions).

export const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

export const truncate = (text: string | undefined, max: number) =>
  !text ? '' : text.length > max ? `${text.slice(0, max)}…` : text;

export const errorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || (typeof err?.response?.data === 'string' ? err.response.data : '') || err?.message || fallback;
