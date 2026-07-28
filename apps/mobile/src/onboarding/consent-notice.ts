// Why: the consent notice text and the version each recorded consent points at.
// Must not: change a word of the text without changing consentNoticeVersion; a consent must name the exact text shown.
export const consentNoticeVersion = "2026-09-24";

export const consentNoticeParagraphs = [
  "WearWise is a wellness coach. It is not a medical device, and it does not diagnose, treat or prevent any condition.",
  "With your permission, WearWise reads health data from Apple Health or Health Connect on this phone, such as heart rate, heart rate variability, sleep, steps and activity. It sends that data to WearWise's servers and stores it there to work out your daily scores and trends.",
  "Your health data is never sold and never used for advertising.",
  "You can stop sharing at any time by removing WearWise's access in Apple Health or Health Connect.",
] as const;
