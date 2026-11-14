/**
 * 쿠팡 Raw_Review(`rData.paging.contents[i]`) → `Review` 매핑. 매핑은 이 파일에만 둔다.
 * (design.md "coupangFields.ts", Requirements 8.1, 9.x, 10.x, 11.1, 11.2)
 *
 * 확인됨 (steering/intake.md "쿠팡 페이지 확인 결과"):
 *   reviewId(숫자), rating(1~5), title, content, vine, isAdventurerReview,
 *   reviewerBadges[].badgeTitle, attachments(배열)
 * 미확인: 아래 DATE_FIELDS, TEXT_FIELDS, PHOTO_URL_KEYS, OPTION_FIELD.
 *   확인 결과가 나오면 이 상수와 fixture, 테스트 기대값만 바꾼다 (Requirement 10.9).
 *
 * 작성자 정보(AUTHOR_FIELDS)는 읽지 않는다. 결과는 9개 필드만 담은 새 객체다.
 * 이 파일은 로그를 남기지 않는다.
 */

import { ADVENTURER_BADGE, MAX_PHOTOS, MAX_TEXT_LENGTH } from './intakeConstants';
import type { Review, Source } from './intakeTypes';

/**
 * 미확인: 화면 날짜가 `createdAt`인지 `reviewAt`인지.
 * 후보: createdAt, reviewAt (둘 다 epoch 밀리초). `reviewAt`은 수정일일 수 있어 `createdAt` 우선.
 * 대체 규칙: 앞에서부터 숫자인 첫 필드를 쓴다. 둘 다 숫자가 아니면 그 리뷰를 건너뛴다.
 */
export const DATE_FIELDS = ['createdAt', 'reviewAt'] as const;

/**
 * 미확인: `content`가 잘리지 않은 전체 본문인지.
 * 대체 규칙: 지금은 `title`, `content` 중 비어 있지 않은 문자열을 `\n`으로 잇는다. 둘 다 없으면 `""`.
 */
export const TEXT_FIELDS = ['title', 'content'] as const;

/**
 * 미확인: `attachments` 원소의 사진 URL 키 (원본·썸네일).
 * 대체 규칙: 원소마다 이 순서로 확인해 처음 찾은 https URL 하나를 쓴다.
 * `//`로 시작하면 `https:`를 붙이고, `https://`가 아니면 버린다. 찾지 못하면 그 원소는 건너뛴다.
 */
export const PHOTO_URL_KEYS = [
  'imgSrcOrigin',
  'imgSrcThumbnail',
  'originalUrl',
  'imageUrl',
  'thumbnailUrl',
  'url',
  'src',
  'path',
] as const;

/**
 * 미확인: 구매 옵션 필드. 후보 `itemName`.
 * 대체 규칙: 비어 있지 않은 문자열이면 trim해서 쓰고, 아니면 `null`.
 */
export const OPTION_FIELD = 'itemName';

/** 읽지 않는 작성자 필드 (참고용 목록. 코드는 이 키를 참조하지 않는다). */
export const AUTHOR_FIELDS = [
  'member',
  'displayWriter',
  'displayName',
  'displayWriterIconUrls',
  'reviewerDisplayImage',
  'reviewerRank',
] as const;

const KST_OFFSET_MS = 9 * 3600_000;

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRating(value: unknown): value is Review['rating'] {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** epoch 밀리초 → KST 기준 `YYYY-MM-DD`. 실행 환경 시간대와 무관하다. 변환할 수 없으면 `null`. */
export function toKstDate(epochMs: number): string | null {
  if (!Number.isFinite(epochMs)) return null;
  const d = new Date(epochMs + KST_OFFSET_MS);
  const year = d.getUTCFullYear();
  if (!Number.isFinite(year)) return null;
  const yyyy = String(year).padStart(4, '0');
  return `${yyyy}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 앞에서부터 `max`개 유니코드 코드 포인트만 남긴다. 서로게이트 쌍을 쪼개지 않는다. */
export function truncateText(text: string, max: number): string {
  const points = Array.from(text);
  if (points.length <= max) return text;
  return points.slice(0, Math.max(0, max)).join('');
}

function normalizePhotoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const url = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  return url.startsWith('https://') ? url : null;
}

/** `attachments` 원소마다 PHOTO_URL_KEYS 순서로 첫 https URL 하나. 중복 없이 최대 MAX_PHOTOS개. */
export function extractPhotos(attachments: unknown): string[] {
  if (!Array.isArray(attachments)) return [];
  const photos: string[] = [];
  for (const item of attachments) {
    if (photos.length >= MAX_PHOTOS) break;
    if (!isRecord(item)) continue;
    for (const key of PHOTO_URL_KEYS) {
      const url = normalizePhotoUrl(item[key]);
      if (url !== null) {
        if (!photos.includes(url)) photos.push(url);
        break;
      }
    }
  }
  return photos;
}

function readDate(raw: RawRecord): string | null {
  for (const field of DATE_FIELDS) {
    const value = raw[field];
    if (typeof value === 'number') return toKstDate(value);
  }
  return null;
}

function readText(raw: RawRecord): string {
  const parts: string[] = [];
  for (const field of TEXT_FIELDS) {
    const value = raw[field];
    if (typeof value === 'string' && value.trim() !== '') parts.push(value);
  }
  return truncateText(parts.join('\n').trim(), MAX_TEXT_LENGTH);
}

function readBadges(raw: RawRecord): string[] {
  const badges: string[] = [];
  const list = raw.reviewerBadges;
  if (Array.isArray(list)) {
    for (const badge of list) {
      if (!isRecord(badge)) continue;
      const title = badge.badgeTitle;
      if (typeof title === 'string' && !badges.includes(title)) badges.push(title);
    }
  }
  const adventurer = raw.vine === true || raw.isAdventurerReview === true;
  if (adventurer && !badges.includes(ADVENTURER_BADGE)) badges.push(ADVENTURER_BADGE);
  return badges;
}

function readOption(raw: RawRecord): string | null {
  const value = raw[OPTION_FIELD];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Raw_Review 하나를 `Review`로 바꾼다. 숫자 `reviewId`가 없거나, `rating`이 1~5 정수가 아니거나,
 * 날짜를 만들 수 없으면 `null`. 작성자 필드는 읽지 않는다.
 */
export function mapCoupangReview(raw: unknown, source: Source): Review | null {
  if (!isRecord(raw)) return null;

  const reviewId = raw.reviewId;
  if (typeof reviewId !== 'number' || !Number.isFinite(reviewId)) return null;

  const rating = raw.rating;
  if (!isRating(rating)) return null;

  const date = readDate(raw);
  if (date === null) return null;

  const attachments = raw.attachments;

  return {
    id: `cp-${reviewId}`,
    rating,
    date,
    text: readText(raw),
    badges: readBadges(raw),
    photos: extractPhotos(attachments),
    hasPhoto: Array.isArray(attachments) && attachments.length > 0,
    option: readOption(raw),
    source,
  };
}
