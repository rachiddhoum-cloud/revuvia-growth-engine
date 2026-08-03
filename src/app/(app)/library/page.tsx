import { ContentLibraryClient } from "@/components/library/content-library-client";
import { loadContentLibrary } from "@/lib/acquisition/library-loader";

export const metadata = {
  title: "Content Library",
};

export default async function LibraryPage() {
  const items = await loadContentLibrary();
  return <ContentLibraryClient items={items} />;
}
