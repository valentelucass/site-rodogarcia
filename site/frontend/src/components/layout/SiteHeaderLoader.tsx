import { fetchPublicContent } from "@/lib/api";
import { DEFAULT_HEADER_NAVIGATION } from "@/lib/headerNavigationDefaults";
import { SiteHeader } from "./SiteHeader";

export async function SiteHeaderLoader() {
  const publicContent = await fetchPublicContent();
  const navigation =
    publicContent.success && publicContent.data?.headerNavigation?.items?.length
      ? publicContent.data.headerNavigation
      : DEFAULT_HEADER_NAVIGATION;

  return <SiteHeader initialNavigation={navigation} />;
}
