/** Store-listing URLs for the in-app "Rate MoveStar" button. Pure (no react-native
 *  import) so it is unit-testable with `node --test`. The caller opens it via Linking. */
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.movestar.app";
// TODO: replace `idTODO` with the real App Store ID once iOS ships.
const IOS_URL = "https://apps.apple.com/app/movestar/idTODO";

export function storeUrl(os: string): string {
  return os === "ios" ? IOS_URL : ANDROID_URL;
}
