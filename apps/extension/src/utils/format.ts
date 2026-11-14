/** 평점 표시: 소수 첫째 자리까지 (4 → "4.0"). 값이 없으면 "-". 계산은 코어 함수가 한다. */
export function fmtRating(value: number | null): string {
  return value === null ? '-' : value.toFixed(1);
}
