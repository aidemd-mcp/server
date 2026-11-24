/**
 * The time-unit constants every module that converts between seconds, minutes, hours, days and
 * milliseconds shares. Pure values with no Node imports, so the observer's browser page imports them
 * from here as readily as the server does.
 */
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;

export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;

export const SECOND_MS = 1000;
export const MINUTE_MS = SECONDS_PER_MINUTE * SECOND_MS;
export const HOUR_MS = SECONDS_PER_HOUR * SECOND_MS;
export const DAY_MS = SECONDS_PER_DAY * SECOND_MS;
