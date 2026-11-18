import type { CapturedPage } from "../crawl/types";
import type { DiscoveryQuestion } from "./schemas";

export function generateDiscoveryQuestions(pages: CapturedPage[]): DiscoveryQuestion[] {
  const questions: DiscoveryQuestion[] = [
    {
      topic: "ERP and OMS",
      question: "Which ERP/OMS systems own inventory, pricing, and order data, and how are they integrated today?",
      reason: "The public crawl cannot observe backend systems or integration contracts.",
    },
    {
      topic: "Search",
      question: "What search platform and ranking or filtering behavior must be preserved?",
      reason: "Search behavior and its indexing source are not observable from representative page captures.",
    },
    {
      topic: "Promotions",
      question: "How are customer segments, promotions, and personalized pricing determined?",
      reason: "The crawl may not expose authenticated or personalized experiences.",
    },
  ];
  if (pages.some((page) => page.template === "cart")) {
    questions.push({
      topic: "Checkout",
      question: "Where does checkout begin, which payment and fraud systems are used, and what integration boundaries must remain?",
      reason: "A cart capture alone cannot show checkout providers or backend ownership.",
    });
  }
  return questions;
}
