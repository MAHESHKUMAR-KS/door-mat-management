import { readAllOrders, readEnquiries } from './dataTools';

const ADMIN_ORDERS_SEEN_KEY = 'dm_admin_seen_orders_ts';
const ADMIN_ENQUIRIES_SEEN_KEY = 'dm_admin_seen_enquiries_ts';

const getLatestTimestamp = (items) => {
  return items.reduce((max, item) => {
    const createdAtTs = Number(new Date(item?.createdAt || 0).getTime()) || 0;
    const idTs = Number(item?.id || 0) || 0;
    return Math.max(max, createdAtTs, idTs);
  }, 0);
};

const readSeenTimestamp = (key) => {
  const value = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(value) ? value : 0;
};

const writeSeenTimestamp = (key, timestamp) => {
  localStorage.setItem(key, String(Number(timestamp) || Date.now()));
};

export const hasNewOrdersAlert = () => {
  const latestOrderTs = getLatestTimestamp(readAllOrders());
  const seenTs = readSeenTimestamp(ADMIN_ORDERS_SEEN_KEY);
  return latestOrderTs > seenTs;
};

export const hasNewEnquiriesAlert = () => {
  const latestEnquiryTs = getLatestTimestamp(readEnquiries());
  const seenTs = readSeenTimestamp(ADMIN_ENQUIRIES_SEEN_KEY);
  return latestEnquiryTs > seenTs;
};

export const markOrdersSeen = () => {
  const latestOrderTs = getLatestTimestamp(readAllOrders());
  writeSeenTimestamp(ADMIN_ORDERS_SEEN_KEY, latestOrderTs || Date.now());
};

export const markEnquiriesSeen = () => {
  const latestEnquiryTs = getLatestTimestamp(readEnquiries());
  writeSeenTimestamp(ADMIN_ENQUIRIES_SEEN_KEY, latestEnquiryTs || Date.now());
};
