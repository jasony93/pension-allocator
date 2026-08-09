// 날짜 산술. **세법 수치가 하나도 없다** — 여기 있는 숫자는 달력의 사실(월별 일수)뿐이고
// 만 나이의 기준일과 연수(55·5)는 전부 밖에서 주입된다.
//
// 왜 별도 모듈인가 — D21이 "만 나이 환산은 화면이 하지 않는다"를 정했다. 환산이 엔진으로
// 들어온 이상 그 산술은 한 곳에만 있어야 한다. 두 곳에서 만 나이를 세면 그 둘이 갈리는 날이 온다.
//
// Date 객체를 쓰지 않는다. 표준시·서머타임·로케일이 개입할 여지를 만들지 않기 위해서다.
// 계약 1절이 "현재 시각을 읽지 않는다"를 못박았고, Date는 그 선을 흐린다.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

/** `YYYY-MM-DD`만 받는다. 달력에 없는 날짜는 파싱 실패다. */
export function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

export function formatIsoDate(date) {
  if (date === null) return null;
  const pad = (value, width) => String(value).padStart(width, '0');
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** 음수면 a < b. 0이면 같은 날. */
export function compareDates(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function maxDate(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  return compareDates(a, b) >= 0 ? a : b;
}

/**
 * n년 뒤 같은 날. 2월 29일처럼 대응하는 날이 없으면 그 달의 마지막 날로 맞춘다.
 * **이것은 세법 해석이 아니라 달력 산술의 관행이다.** 룰셋에 이 처리를 정한 규칙이 없고,
 * 어긋나는 날은 윤년의 2월 29일 하루뿐이다. 그 하루가 판정을 바꾸는 사용자가 나오면
 * tax-domain이 정할 일이므로 engine-interface.md의 open_questions에 남겼다.
 */
export function addYears(date, years) {
  const year = date.year + years;
  const day = Math.min(date.day, daysInMonth(year, date.month));
  return { year, month: date.month, day };
}

/** 기준일 현재의 만 나이. 생일 당일에 한 살 오른다. */
export function ageOn(birthDate, referenceDate) {
  let age = referenceDate.year - birthDate.year;
  if (
    referenceDate.month < birthDate.month ||
    (referenceDate.month === birthDate.month && referenceDate.day < birthDate.day)
  ) {
    age -= 1;
  }
  return age;
}

/**
 * 기준일부터 목표일까지 남은 햇수를 **올림**으로 센다.
 * 올림인 이유: 이 값이 쓰이는 곳이 전부 잠금기간 표시라 짧게 보이는 쪽이 위험하다.
 * 이미 지난 날짜면 0이다.
 */
export function yearsUntil(referenceDate, targetDate) {
  if (compareDates(targetDate, referenceDate) <= 0) return 0;
  let years = targetDate.year - referenceDate.year;
  if (compareDates(addYears(referenceDate, years), targetDate) < 0) years += 1;
  return years;
}

/** 과세연도의 종료일. 기준일 규칙이 룰셋에 없어 엔진이 이 값을 쓴다는 사실은 assumptions에 실린다. */
export function endOfTaxYear(taxYear) {
  return { year: taxYear, month: 12, day: 31 };
}
