/** Formatação de números em pt-BR */
export const format = {
  number: (n: number, maxDecimals = 2) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: maxDecimals,
      minimumFractionDigits: 0,
    }).format(n);
  },

  currency: (value: number, currency = 'EUR') => {
    const suffixes = ['', ' mil', ' mi', ' bi'];
    let num = value;
    let suffixIndex = 0;

    while (num >= 1000 && suffixIndex < suffixes.length - 1) {
      num /= 1000;
      suffixIndex++;
    }

    const trimmedSuffix = suffixes[suffixIndex] ? `${suffixes[suffixIndex]} ` : '';
    return `${num.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${trimmedSuffix}${currency}`.replace(/\s+/g, ' ');
  },

  percentage: (value: number) => {
    return `${value.toFixed(0)}%`;
  },

  minutes: (minute: number) => {
    const mins = Math.floor(minute);
    return `${mins}'`;
  },

  date: (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  },

  datetime: (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  },
};