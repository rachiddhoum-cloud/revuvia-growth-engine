import { ContentLibraryClient } from "@/components/library/content-library-client";

export const metadata = {
  title: "Content Library",
};

export default function LibraryPage() {
  return <ContentLibraryClient items={[]} />;
}
