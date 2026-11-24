import { Suspense } from "react";

import { TravelScreen } from "@/components/travel-screen";

export default function TravelPage() {
  return (
    <Suspense fallback={null}>
      <TravelScreen />
    </Suspense>
  );
}
