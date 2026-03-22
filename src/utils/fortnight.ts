import {getDate, getMonth, getYear} from 'date-fns';

export function getFortnightId(date: Date, userId: string, clientId: string): string {
  const year = getYear(date);
  const month = getMonth(date) + 1;
  const day = getDate(date);
  const period = day <= 15 ? 1 : 2;
  return `${userId}_${clientId}_${year}_${month}_${period}`;
}

export function getFortnightInfo(date: Date) {
  const year = getYear(date);
  const month = getMonth(date) + 1;
  const day = getDate(date);
  const period = day <= 15 ? 1 : 2;
  return {year, month, period};
}

export function formatFortnight(year: number, month: number, period: number): string {
  const monthNames = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  return `${period}ª Quinzena de ${monthNames[month - 1]} de ${year}`;
}

// Formata valor monetário em BRL
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
