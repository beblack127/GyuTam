import type { Review } from './review.ts';

export type IntakeDoneReason = null | 'blocked' | 'captcha' | 'unexpected' | 'hidden_tab';

export type IntakeErrorReason = 'not_product_page' | 'blocked' | 'parse_failed';

/** `tabId`는 `chrome.tabs.Tab.id`와 같은 number다. */
export interface IntakeStartMessage {
  type: 'intake:start';
  tabId: number;
}

export interface IntakeProgressMessage {
  type: 'intake:progress';
  tabId: number;
  done: number;
  total: number;
}

export interface IntakeDoneMessage {
  type: 'intake:done';
  tabId: number;
  reviews: Review[];
  partial: boolean;
  reason: IntakeDoneReason;
}

export interface IntakeErrorMessage {
  type: 'intake:error';
  tabId: number;
  reason: IntakeErrorReason;
}

export type IntakeMessage =
  | IntakeStartMessage
  | IntakeProgressMessage
  | IntakeDoneMessage
  | IntakeErrorMessage;
